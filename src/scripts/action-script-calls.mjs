/*
 * Action-Scoped Script Calls
 *
 * Repeats a subset of the script call categories on each action's sheet (Misc
 * tab, at the bottom). Scripts entered there only fire when *that* action is
 * used, unlike the item-level lists which fire for every action on the item.
 *
 *  - Pre-Activate -> pf1PreAttackDialog  (before the dialog opens)
 *  - Pre-Use      -> pf1PostAttackDialog (after the dialog closes)
 *  - Use          -> ActionUse.executeScriptCalls("use")
 *  - Post-Use     -> ActionUse.executeScriptCalls("postUse")
 *
 * Storage: these are ordinary `ItemScriptCall`s living in the parent item's
 * `system.scriptCalls`, tagged with a synthetic category of the form
 * `action:<actionId>:<category>`. Actions are data models with a closed schema
 * and no flags field, so there is nowhere on the action itself to put them.
 * Because the synthetic category is never registered with
 * `pf1.registry.scriptCalls`, the item sheet's own Script Calls section ignores
 * them — they show up only on the action that owns them.
 */

const MODULE_ID = "pf1-new-script-hooks";

/** Category prefix marking a script call as belonging to a single action. */
const SCOPE_PREFIX = "action:";

/** The categories repeated on the action sheet, in display order. */
const ACTION_CATEGORIES = [
  {
    id: "preActivate",
    name: "Pre-Activate",
    info: "Runs before the attack dialog opens, for this action only.",
  },
  {
    id: "preUse",
    name: "Pre-Use",
    info: "Runs after the attack dialog closes and before roll calculations, for this action only.",
  },
  {
    id: "use",
    name: "Use",
    info: "Runs after attacks are generated and before the chat card is posted, for this action only.",
  },
  {
    id: "postUse",
    name: "Post-Use",
    info: "Runs after the chat card has been posted, for this action only.",
  },
];

const CATEGORY_IDS = new Set(ACTION_CATEGORIES.map((c) => c.id));

/* -------------------------------------------- */
/*  Category helpers                            */
/* -------------------------------------------- */

/**
 * Synthetic category id for one action + one category.
 *
 * @param {string} actionId - Action id
 * @param {string} category - Base category id, e.g. "preUse"
 * @returns {string} - Stored category id
 */
export const scopedCategory = (actionId, category) => `${SCOPE_PREFIX}${actionId}:${category}`;

/**
 * Prefix shared by every scoped category of one action.
 *
 * @param {string} actionId - Action id
 * @returns {string} - Category prefix
 */
export const scopePrefix = (actionId) => `${SCOPE_PREFIX}${actionId}:`;

/* -------------------------------------------- */
/*  Execution                                   */
/* -------------------------------------------- */

/**
 * Execute the action-scoped script calls of one category.
 *
 * Mirrors `ItemPF.executeScriptCalls`, but stamps `shared.category` with the
 * plain category (not the synthetic one) so scripts see the same value they
 * would in an item-level list, and rethrows so a failing script cancels the
 * action just as PF1 does.
 *
 * @param {ItemPF} item - Item owning the script calls
 * @param {string} actionId - Action being used
 * @param {string} category - Base category id, e.g. "preUse"
 * @param {object} [shared={}] - Shared data object, passed through from the item-level calls
 * @param {object} [extraParams={}] - Extra variables for the script scope
 * @returns {Promise<object>} - The shared object
 */
export async function runActionScriptCalls(item, actionId, category, shared = {}, extraParams = {}) {
  if (!item || !actionId || !CATEGORY_IDS.has(category)) return shared;

  const stored = scopedCategory(actionId, category);
  const scripts = item.scriptCalls?.filter((sc) => sc.category === stored) ?? [];
  if (!scripts.length) return shared;

  shared.category = category;
  shared.actionScoped = true;

  try {
    for (const sc of scripts) await sc.execute(shared, extraParams);
  } catch (error) {
    console.error(`${MODULE_ID} | Action script call execution failed\n`, error, item, actionId, category);
    // Rethrow to ensure everything cancels, matching ItemPF.executeScriptCalls
    throw new Error("Error occurred while executing an action script call", { cause: error });
  } finally {
    shared.actionScoped = false;
  }

  return shared;
}

/* -------------------------------------------- */
/*  Wrappers                                    */
/* -------------------------------------------- */

Hooks.once("ready", () => {
  if (!game.modules.get("lib-wrapper")?.active) {
    console.warn(`${MODULE_ID} | libWrapper is required for action-scoped script calls. Feature disabled.`);
    return;
  }

  // Use / Post-Use. Both go through the one ActionUse funnel, which knows the action.
  libWrapper.register(
    MODULE_ID,
    "pf1.actionUse.ActionUse.prototype.executeScriptCalls",
    actionUseScriptCallsWrapper,
    "WRAPPER"
  );

  // Housekeeping: a deleted action's scripts would otherwise linger unreachable,
  // and a duplicated action would silently lose them.
  libWrapper.register(MODULE_ID, "pf1.components.ItemAction.prototype.delete", actionDeleteWrapper, "WRAPPER");
  libWrapper.register(
    MODULE_ID,
    "pf1.applications.item.ItemSheetPF.prototype._onActionControl",
    actionControlWrapper,
    "WRAPPER"
  );
});

/**
 * Run this action's own `use` / `postUse` scripts after the item-level ones.
 *
 * @this {ActionUse}
 * @param {Function} wrapped - Wrapped function
 * @param {string} [category] - Script call category
 * @returns {Promise<*>} - Wrapped result
 */
async function actionUseScriptCallsWrapper(wrapped, category = "use") {
  const result = await wrapped(category);

  if (category !== "use" && category !== "postUse") return result;

  const shared = this.shared;

  // An item-level `use` script already cancelled; don't pile on.
  if (category === "use" && shared?.scriptData?.reject) return result;

  try {
    await runActionScriptCalls(this.item, this.action?.id, category, shared);
  } catch (err) {
    // `use` aborts the action (PF1 lets the throw propagate); `postUse` runs
    // after the card is posted, so swallowing keeps the rest of the flow intact.
    if (category === "use") throw err;
    console.error(`${MODULE_ID} | Post-Use action script call failed:`, err);
  }

  // ActionUse sets shared.scriptData = shared, so anything the scripts wrote
  // (reject, hideChat, ...) is already visible without reassigning it here.

  return result;
}

/**
 * Strip an action's scoped script calls when the action itself is deleted.
 *
 * @this {ItemAction}
 * @param {Function} wrapped - Wrapped function
 * @param {...*} args - Wrapped arguments
 * @returns {Promise<*>} - Wrapped result
 */
async function actionDeleteWrapper(wrapped, ...args) {
  const item = this.item;
  const prefix = scopePrefix(this.id);

  const result = await wrapped(...args);

  try {
    const raw = item?.toObject().system.scriptCalls ?? [];
    const kept = raw.filter((sc) => !sc.category?.startsWith(prefix));
    if (kept.length !== raw.length) await item.update({ "system.scriptCalls": kept });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to clean up script calls of a deleted action:`, err);
  }

  return result;
}

/**
 * Carry scoped script calls across to the copy when an action is duplicated.
 *
 * PF1 duplicates inline in `_onActionControl` with no hook of its own, so the
 * new action is identified by diffing action ids around the call.
 *
 * @this {ItemSheetPF}
 * @param {Function} wrapped - Wrapped function
 * @param {Event} event - Triggering event
 * @param {...*} args - Remaining arguments
 * @returns {Promise<*>} - Wrapped result
 */
async function actionControlWrapper(wrapped, event, ...args) {
  const a = event?.currentTarget;
  const isDuplicate = a?.classList?.contains("duplicate-action");
  // currentTarget is only valid during dispatch, so read everything up front.
  const sourceId = isDuplicate ? a.closest(".item[data-action-id]")?.dataset.actionId : null;
  const priorIds = sourceId ? new Set(this.item.actions.map((action) => action.id)) : null;

  const result = await wrapped(event, ...args);

  if (!sourceId) return result;

  try {
    const newId = this.item.actions.find((action) => !priorIds.has(action.id))?.id;
    if (!newId) return result;

    const sourcePrefix = scopePrefix(sourceId);
    const raw = this.item.toObject().system.scriptCalls ?? [];
    const copies = raw
      .filter((sc) => sc.category?.startsWith(sourcePrefix))
      .map((sc) => ({
        ...sc,
        _id: foundry.utils.randomID(8),
        category: scopedCategory(newId, sc.category.slice(sourcePrefix.length)),
      }));

    if (copies.length) await this.item.update({ "system.scriptCalls": [...raw, ...copies] });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to copy script calls to a duplicated action:`, err);
  }

  return result;
}

/* -------------------------------------------- */
/*  Action sheet UI                             */
/* -------------------------------------------- */

Hooks.on("renderItemActionSheet", (app, html) => {
  injectActionScriptCalls(app, html).catch((err) =>
    console.error(`${MODULE_ID} | Failed to render action script calls:`, err)
  );
});

/**
 * Append the script calls lists to the action sheet's Misc tab.
 *
 * @param {ItemActionSheet} app - Action sheet
 * @param {JQuery<HTMLElement>} html - Rendered sheet
 */
async function injectActionScriptCalls(app, html) {
  const action = app?.action;
  const item = app?.item;
  if (!action?.id || !item) return;

  const $html = html instanceof jQuery ? html : $(html);
  const $tab = $html.find('.tab[data-tab="misc"]');
  if (!$tab.length) return;
  if ($tab.find(".nsh-action-script-calls").length) return; // Already injected

  const $section = $(buildSection(item, action.id));
  $tab.append($section);

  if (app.isEditable) $section.on("click", "a.item-control", (ev) => onScriptCallControl(ev, app));
  else $section.find("a.item-control").remove();
}

/**
 * @param {ItemPF} item - Item owning the script calls
 * @param {string} actionId - Action id
 * @returns {string} - Section markup
 */
function buildSection(item, actionId) {
  const isGM = game.user.isGM;
  const owner = item.isOwner;

  const lists = ACTION_CATEGORIES.map(({ id, name, info }) => {
    const stored = scopedCategory(actionId, id);
    const scripts = item.scriptCalls?.filter((sc) => sc.category === stored && !sc.hide) ?? [];

    const rows = scripts
      .map(
        (sc) => `
      <li class="item flexrow" data-item-id="${sc.id}">
        <div class="item-name">
          <div class="item-image no-hover" style="background-image: url(&quot;${esc(sc.img)}&quot;)"></div>
          <h4>${esc(sc.name)}</h4>
        </div>
        ${
          isGM
            ? `<div class="item-detail item-hidden">
                 <a class="item-control item-hide">
                   <span class="hidden-icon">
                     <i class="fa-solid ${sc.hidden ? "fa-check is-visible" : "fa-times is-hidden"} fa-fw" inert></i>
                   </span>
                 </a>
               </div>`
            : ""
        }
        <div class="item-controls">
          <a class="item-control item-edit" data-tooltip="PF1.EditItem"><i class="fa-solid fa-edit" inert></i></a>
          ${
            owner
              ? `<a class="item-control item-delete" data-tooltip="PF1.DeleteItem"><i class="fa-solid fa-trash" inert></i></a>`
              : ""
          }
        </div>
      </li>`
      )
      .join("");

    return `
    <ol class="item-list" data-category="${esc(stored)}">
      <li class="item-list-header flexrow">
        <div class="item-name">
          <i class="fa-solid fa-info fa-fw item-info" data-tooltip="${esc(info)}"></i>
          <h3>${esc(name)}</h3>
        </div>
        ${
          isGM
            ? `<div class="item-detail item-hidden"><i class="fa-solid fa-eye-slash" data-tooltip="PF1.Hidden"></i></div>`
            : ""
        }
        <div class="item-controls">
          ${
            owner
              ? `<a class="item-control item-create" data-tooltip="PF1.ScriptCalls.Create"><i class="fa-solid fa-plus" inert></i></a>`
              : ""
          }
        </div>
      </li>
      <ol class="item-list">${rows}</ol>
    </ol>`;
  }).join("");

  return `
  <div class="nsh-action-script-calls">
    <h3 class="form-header">${esc(game.i18n.localize("PF1.ScriptCalls.Name"))}</h3>
    <p class="notes">Scripts here run only when this action is used, in addition to the item's own lists.</p>
    ${lists}
  </div>`;
}

/**
 * Create / edit / delete / hide, mirroring `ItemSheetPF._onScriptCallControl`.
 *
 * @param {Event} event - Click event
 * @param {ItemActionSheet} app - Action sheet
 */
async function onScriptCallControl(event, app) {
  event.preventDefault();
  event.stopPropagation();

  const a = event.currentTarget;
  const item = app.item;
  const category = a.closest(".item-list[data-category]")?.dataset.category;
  const script = item.scriptCalls?.get(a.closest(".item")?.dataset.itemId);

  // Create
  if (a.classList.contains("item-create")) {
    if (!category) return;
    await app._onSubmit(event, { preventRender: true }); // Save pending action edits first
    const created = await pf1.components.ItemScriptCall.create([{ category, type: "script" }], { parent: item });
    created?.forEach((sc) => sc.edit());
    return;
  }

  if (!script) return;

  // Delete
  if (a.classList.contains("item-delete")) {
    await app._onSubmit(event, { preventRender: true });
    const kept = (item.toObject().system.scriptCalls ?? []).filter((sc) => sc._id !== script.id);
    return item.update({ "system.scriptCalls": kept });
  }
  // Edit
  else if (a.classList.contains("item-edit")) {
    return script.edit({ editable: app.isEditable });
  }
  // Toggle hidden
  else if (a.classList.contains("item-hide")) {
    await app._onSubmit(event, { preventRender: true });
    return script.update({ hidden: !script.hidden });
  }
}

/**
 * @param {string} value - Untrusted string
 * @returns {string} - HTML-escaped string
 */
function esc(value) {
  return Handlebars.escapeExpression(value ?? "");
}
