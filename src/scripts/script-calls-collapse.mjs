/*
 * Collapsible Script Calls sections
 *
 * Both script-call sections — PF1's own on the item sheet's Advanced tab, and
 * the action-scoped one this module appends to the action sheet's Misc tab —
 * are tall, and the great majority of items and actions put nothing in either.
 * They get the house treatment: the `h3.form-header` is the toggle, a topical
 * icon paired with the title is the state cue, a badge on the right carries the
 * script count while shut, and the default is open only when something is
 * actually configured.
 *
 * The mechanism is the vendored sheet kit (`src/common/sheet/collapse.mjs`),
 * the same copy every other module here uses. Nothing is written to the
 * document — opening an item to look at it must write nothing.
 *
 * Note that the item-sheet section is *core's*, not one this module injected.
 * Collapsing it is the point: it sits on the Advanced tab alongside the
 * sections other modules append, and an uncollapsed one is the thing pushing
 * everything else off screen.
 */

import { makeCollapsible } from "../common/sheet/collapse.mjs";

const MODULE_ID = "pf1-new-script-hooks";

/** Class marking a section this file has already processed, per section. */
const ITEM_MARKER = "nsh-script-calls-collapse";
const ACTION_MARKER = "nsh-action-script-calls-collapse";

/** Paired with the title as the open/closed cue. */
const ICON = "fa-solid fa-code";

/** Marks the icon as ours, so a re-entrant render doesn't add a second one. */
const ICON_CLASS = "nsh-collapse-icon";

/**
 * Count the script rows a section is displaying.
 *
 * Read off the DOM rather than the document so the badge matches what is on
 * screen: a player does not see hidden scripts, and the badge must not tell
 * them how many they are missing.
 *
 * @param {HTMLElement} root - Section root
 * @returns {number} - Rows displayed
 */
const countScripts = (root) => root.querySelectorAll(".item-list .item[data-item-id]").length;

/**
 * Wrap everything after the header in a single element, which is what the
 * collapse kit needs to show and hide.
 *
 * @param {HTMLElement} root - Section root
 * @param {HTMLElement} header - The header to collapse by
 * @returns {HTMLElement} - The body wrapper
 */
function wrapBody(root, header) {
  const body = document.createElement("div");
  body.className = "nsh-collapse-body";
  // Collected first: moving a node out of `root.children` mutates it mid-walk.
  const rest = [...root.children].filter((el) => el !== header);
  body.append(...rest);
  root.append(body);
  return body;
}

/**
 * Add the state-cue icon at the head of the header.
 *
 * It has to be the *first* child: the kit sizes `> i:first-child` to a fixed
 * 1.25em box so that every section title on the tab starts at the same x, and
 * an icon placed after core's help-browser link would miss that rule and sit a
 * few pixels out from its neighbours — which is the one thing this is for.
 * Core's help link keeps its place, just to the icon's right.
 *
 * @param {HTMLElement} header - The section header
 */
function addIcon(header) {
  if (header.querySelector(`.${ICON_CLASS}`)) return;

  const icon = document.createElement("i");
  icon.className = `${ICON} ${ICON_CLASS}`;
  icon.setAttribute("inert", "");
  header.prepend(icon);
}

/**
 * Make one script-calls section collapsible.
 *
 * @param {Application} app - The sheet the section lives on
 * @param {HTMLElement} root - Section root
 * @param {object} opts
 * @param {string} opts.marker - De-dup class, this feature's own
 * @param {string} opts.key - Distinguishes sections sharing one sheet
 */
function collapseSection(app, root, { marker, key }) {
  if (!root || root.classList.contains(marker)) return;

  const header = root.querySelector("h3.form-header");
  if (!header) return;

  root.classList.add(marker);
  addIcon(header);

  const count = countScripts(root);

  makeCollapsible(app, root, {
    key,
    header: "h3.form-header",
    // `:scope >` so a nested list can never be mistaken for the body.
    body: ":scope > .nsh-collapse-body",
    // Most items and actions script nothing and should cost a line of the tab
    // rather than a screen of it.
    configured: count > 0,
    badge: count,
  });
}

/**
 * The item sheet's own Script Calls section, on the Advanced tab.
 *
 * `renderItemSheetPF` also covers container sheets, whose own close hook the
 * kit already listens for.
 */
Hooks.on("renderItemSheetPF", (app, html) => {
  try {
    const root = (html instanceof jQuery ? html[0] : html)?.querySelector("div.script-calls");
    if (!root) return;

    const header = root.querySelector("h3.form-header");
    if (header && !root.querySelector(":scope > .nsh-collapse-body")) wrapBody(root, header);

    collapseSection(app, root, { marker: ITEM_MARKER, key: "scriptCalls" });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to collapse the Script Calls section:`, err);
  }
});

/**
 * The action-scoped section, built by action-script-calls.mjs. Called from
 * there rather than off a hook, so it runs after the section exists.
 *
 * @param {Application} app - Action sheet
 * @param {HTMLElement|JQuery} section - The injected section
 */
export function collapseActionScriptCalls(app, section) {
  try {
    const root = section instanceof jQuery ? section[0] : section;
    collapseSection(app, root, { marker: ACTION_MARKER, key: "actionScriptCalls" });
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to collapse the action Script Calls section:`, err);
  }
}
