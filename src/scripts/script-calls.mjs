/*
 * Script Calls: Pre-Activate / Pre-Use
 *
 * Registers two new script call categories with the PF1 system and executes
 * them at the hook points provided by dialog-hooks.mjs:
 *  - preActivate -> pf1PreAttackDialog  (before dialog opens)
 *  - preUse      -> pf1PostAttackDialog (after dialog closes, before rolls)
 *
 * Also wraps ItemSheetPF._prepareScriptCalls to ensure Pre-Activate and
 * Pre-Use appear at the top of the script calls UI for clarity.
 */

(() => {
"use strict";

const MODULE_ID = "pf1-new-script-hooks";
const CATEGORY_PRE_ACTIVATE = "preActivate";
const CATEGORY_PRE_USE = "preUse";

const DEFAULT_ITEM_TYPES = [
  "attack",
  "buff",
  "feat",
  "loot",
  "equipment",
  "implant",
  "consumable",
  "spell",
  "weapon",
];

// ---- Register script call categories ---- //

Hooks.on("pf1RegisterScriptCalls", (registry) => {
  try {
    registry.register(MODULE_ID, CATEGORY_PRE_ACTIVATE, {
      itemTypes: DEFAULT_ITEM_TYPES,
      name: "Pre-Activate",
      info: "Runs before the attack dialog opens.",
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Pre-Activate script call category already registered.`);
  }

  try {
    registry.register(MODULE_ID, CATEGORY_PRE_USE, {
      itemTypes: DEFAULT_ITEM_TYPES,
      name: "Pre-Use",
      info: "Runs after the attack dialog closes and before roll calculations.",
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Pre-Use script call category already registered.`);
  }

  try {
    registry.register(MODULE_ID, "turnStart", {
      itemTypes: DEFAULT_ITEM_TYPES,
      name: "Turn Start",
      info: "Runs at the start of this actor's turn in combat.",
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Turn Start script call category already registered.`);
  }

  try {
    registry.register(MODULE_ID, "turnEnd", {
      itemTypes: DEFAULT_ITEM_TYPES,
      name: "Turn End",
      info: "Runs at the end of this actor's turn in combat.",
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Turn End script call category already registered.`);
  }

  try {
    registry.register(MODULE_ID, "preToggle", {
      itemTypes: ["buff"],
      name: "Pre-Toggle",
      info: "Runs before a buff's active state changes. Set shared.reject = true to cancel the toggle.",
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Pre-Toggle script call category already registered.`);
  }

  try {
    registry.register(MODULE_ID, "create", {
      itemTypes: [...DEFAULT_ITEM_TYPES, "class", "race", "container"],
      name: "Create",
      info: "Runs when the item is added to an actor (e.g. dropped from a compendium).",
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Create script call category already registered.`);
  }
});

// ---- UI ordering wrapper ---- //

Hooks.once("ready", () => {
  if (!game.modules.get("lib-wrapper")?.active) {
    console.warn(`${MODULE_ID} | libWrapper is required for UI ordering. Feature disabled.`);
    return;
  }

  libWrapper.register(
    MODULE_ID,
    "pf1.applications.item.ItemSheetPF.prototype._prepareScriptCalls",
    prepareScriptCallsWrapper,
    "WRAPPER"
  );
});

// ---- Hook handlers ---- //

Hooks.on("pf1PreAttackDialog", (actionUse, promises) => {
  if (!actionUse?.item) return;
  const shared = actionUse.shared ?? {};
  shared.actionUse = actionUse;
  const p = actionUse.item
    .executeScriptCalls(CATEGORY_PRE_ACTIVATE, {}, shared)
    .catch((err) => console.error(`${MODULE_ID} | Pre-Activate script call execution failed:`, err));
  if (promises) promises.push(p);
});

Hooks.on("pf1PostAttackDialog", (actionUse, formData, promises) => {
  if (!actionUse?.item) return;
  const shared = actionUse.shared ?? {};
  shared.actionUse = actionUse;
  if (formData) shared.formData = formData;
  const p = actionUse.item
    .executeScriptCalls(CATEGORY_PRE_USE, { formData }, shared)
    .catch((err) => console.error(`${MODULE_ID} | Pre-Use script call execution failed:`, err));
  if (promises) promises.push(p);
});

// ---- UI ordering helper ---- //

async function prepareScriptCallsWrapper(wrapped, ...args) {
  await wrapped(...args);

  const context = args?.[0];
  if (!context?.scriptCalls) return;

  const originalOrder = Object.keys(context.scriptCalls);
  const pinnedTop = [CATEGORY_PRE_ACTIVATE, CATEGORY_PRE_USE];
  const reordered = {};

  // Pinned to top
  for (const key of pinnedTop) {
    if (context.scriptCalls[key]) reordered[key] = context.scriptCalls[key];
  }

  // Remaining in original order; inject preToggle immediately before toggle
  for (const key of originalOrder) {
    if (reordered[key]) continue;
    if (key === "preToggle") continue; // placed just before toggle below

    if (key === "toggle" && context.scriptCalls["preToggle"]) {
      reordered["preToggle"] = context.scriptCalls["preToggle"];
    }

    reordered[key] = context.scriptCalls[key];
  }

  // Fallback: if toggle never appeared, append preToggle at end
  if (!reordered["preToggle"] && context.scriptCalls["preToggle"]) {
    reordered["preToggle"] = context.scriptCalls["preToggle"];
  }

  context.scriptCalls = reordered;
}

})();
