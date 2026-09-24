/*
 * Button Hooks
 *
 * Registers the `chatButton` script call category.
 *
 * Unlike every other category here, nothing in this module fires it. It is a
 * hook point that astora-mod's Action Buttons dispatches into when a chat-card
 * button of type "script-call" is pressed. The category exists so the list is
 * editable on the item sheet — a script call has to be a registered category to
 * appear there at all.
 *
 * Soft dependency, same shape as rest-hooks.mjs: with astora-mod absent nothing
 * can ever press such a button, so the category is not registered rather than
 * offered as a list that silently never runs.
 *
 * Kept out of this module's README on purpose: the category does nothing
 * without astora-mod, which is personal and unpublished, so it is not
 * public-use documentation. The reference lives beside the only thing that can
 * press such a button — astora-mod/action-buttons/README.md, under "The
 * script-call type".
 *
 * Scope, on top of the standard `item` / `actor` / `token` / `shared`:
 *   message     the ChatMessage carrying the button
 *   data        the descriptor's `data` payload, whatever the author put there
 *   button      { id, descriptor } — the button that fired
 * and `shared.remove` is the way back out: set it true to drop the button after
 * the run, false to keep a one-off button alive.
 */

(() => {
"use strict";

const MODULE_ID = "pf1-new-script-hooks";
const ASTORA_ID = "astora-mod";
const CATEGORY_CHAT_BUTTON = "chatButton";

const ITEM_TYPES = [
  "attack",
  "buff",
  "feat",
  "loot",
  "equipment",
  "implant",
  "consumable",
  "spell",
  "weapon",
  "class",
  "race",
  "container",
];

/** Is the module that presses these buttons installed and on? */
const astoraActive = () => game.modules.get(ASTORA_ID)?.active === true;

Hooks.on("pf1RegisterScriptCalls", (registry) => {
  if (!astoraActive()) return;

  try {
    registry.register(MODULE_ID, CATEGORY_CHAT_BUTTON, {
      itemTypes: ITEM_TYPES,
      name: "Chat Button",
      info:
        "Runs when an astora-mod chat-card button of type \"script-call\" aimed at this item is "
        + "pressed. Never fires on its own. `message`, `data` and `button` are in scope; set "
        + "`shared.remove` to control whether the button survives. Requires astora-mod.",
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Chat Button script call category already registered.`);
  }
});

})();
