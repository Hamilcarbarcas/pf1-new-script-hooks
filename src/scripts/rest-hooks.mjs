/*
 * Rest Hooks
 *
 * Bridges astora-mod's rest manager to a script call category, so an item can
 * react to a rest the same way it reacts to a turn boundary.
 *
 *  - restEnd -> astoraRestEnded (every way a rest can end)
 *
 * Soft dependency. astora-mod owns the hook, so with it absent there is nothing
 * to bridge and the category is not registered at all — a category that can
 * never fire is worse than a missing one, because it invites scripts that
 * silently never run.
 *
 * The category fires for *every* ending, resolved or not, and the record says
 * which. That mirrors the hook rather than second-guessing it: a script that
 * wants to fire only on a completed night writes the gate itself, and one that
 * wants to clean up after an interrupted camp can.
 */

(() => {
"use strict";

const MODULE_ID = "pf1-new-script-hooks";
const ASTORA_ID = "astora-mod";
const CATEGORY_REST_END = "restEnd";

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

/** Is the module that fires the hook installed and on? */
const astoraActive = () => game.modules.get(ASTORA_ID)?.active === true;

// ---- Register the category ---- //

Hooks.on("pf1RegisterScriptCalls", (registry) => {
  if (!astoraActive()) return;

  try {
    registry.register(MODULE_ID, CATEGORY_REST_END, {
      itemTypes: ITEM_TYPES,
      name: "Rest End",
      info:
        "Runs when a rest ends, resolved or not. `rest.resolved` is true only when it "
        + "completed; `rest.type` is short, long or bed. Requires astora-mod.",
    });
  } catch (err) {
    console.warn(`${MODULE_ID} | Rest End script call category already registered.`);
  }
});

// ---- Hook handler ---- //

Hooks.once("ready", () => {
  if (!astoraActive()) {
    console.warn(`${MODULE_ID} | astora-mod is not active; Rest End script calls are disabled.`);
    return;
  }

  Hooks.on("astoraRestEnded", (rest) => {
    onRestEnded(rest).catch((err) =>
      console.error(`${MODULE_ID} | Rest End script call execution failed:`, err)
    );
  });

  console.log(`${MODULE_ID} | Rest hooks registered.`);
});

/**
 * Run every resting actor's `restEnd` scripts.
 *
 * astora-mod fires its hook on every client, so this has to pick one or the
 * scripts run once per connected user. `activeOwner.isSelf` is the same gate
 * combat-hooks uses: exactly one client per actor, and the one with the right
 * permissions to write to it — the owning player when they are online, the GM
 * otherwise.
 *
 * A failing script is logged and the next actor still runs. Unlike a use, there
 * is nothing left to cancel by the time a rest has ended, so letting one item's
 * error strip the rest of the party of theirs would be pure loss.
 *
 * @param {object} rest - The astoraRestEnded record
 * @returns {Promise<void>}
 */
async function onRestEnded(rest = {}) {
  for (const actor of rest.actors ?? []) {
    if (!actor?.activeOwner?.isSelf) continue;

    // One object per actor: `shared` is a scratchpad scripts write to, and the
    // party should not be passing notes through it by accident.
    const shared = { actor, rest };
    const extraParams = { rest };

    for (const item of actor.items) {
      if (!item.isActive) continue;
      try {
        await item.executeScriptCalls(CATEGORY_REST_END, extraParams, shared);
      } catch (err) {
        console.error(`${MODULE_ID} | restEnd script call failed on "${item.name}":`, err);
      }
    }
  }
}

})();
