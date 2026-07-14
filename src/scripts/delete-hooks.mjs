/*
 * Delete Hooks
 *
 * Fires a `delete` script call the moment an item is removed from an actor —
 * e.g. deleted from a sheet, or removed programmatically. Uses Foundry's native
 * `deleteItem` hook, so no libWrapper wrapping is needed.
 *
 * This is the mirror image of create-hooks.mjs. It runs once, on the client of
 * the user who deleted the item, and only for actor-embedded items (world items
 * are ignored).
 *
 * Timing: `deleteItem` fires *after* the item has been removed from the actor's
 * collection. The in-memory item document handed to the hook is detached but
 * fully readable — its `.parent` (actor), `system.scriptCalls`, and flags are
 * all still intact, so `executeScriptCalls` and the item/actor/token context it
 * derives work exactly as they do in the create hook. A script that recounts the
 * actor's remaining items will see the post-removal state (the deleted item is
 * already gone from the collection).
 *
 * The script call runner supplies `item`, `actor`, and `token` automatically
 * (derived from the item's parent). In addition this hook passes:
 *  - extraParams.options : the deletion options object
 *  - extraParams.userId  : the id of the user who deleted the item
 *
 * Bulk-deletion guard: when a whole actor is deleted, its embedded items may
 * also fire `deleteItem`. We do NOT want the `delete` script to run for those —
 * only for items deliberately removed from an actor that continues to exist. We
 * track actors that are mid-deletion and skip their items. The actor's own
 * delete hook fires in the same synchronous batch as its items' hooks, so we
 * register the id when the actor is (pre)deleted and release it on the next tick,
 * after that batch has drained but before any later manual deletion.
 */

(() => {
"use strict";

const MODULE_ID = "pf1-new-script-hooks";
const CATEGORY_DELETE = "delete";

// Ids of actors currently being deleted.
const actorsBeingDeleted = new Set();

const markActorDeleting = (actor) => {
  if (actor?.id) actorsBeingDeleted.add(actor.id);
};

// Register as early as possible so a child deleteItem can never sneak in first...
Hooks.on("preDeleteActor", markActorDeleting);

// ...and again on delete, then release on the next macrotask once this
// operation's synchronous descendant item hooks have run.
Hooks.on("deleteActor", (actor) => {
  markActorDeleting(actor);
  setTimeout(() => actorsBeingDeleted.delete(actor.id), 0);
});

Hooks.on("deleteItem", (item, options, userId) => {
  // Only the initiating client runs it (the user who deleted the item).
  if (game.user.id !== userId) return;
  // Actor-embedded items only; skip world/compendium-directory items.
  if (!item.actor) return;
  if (!(item instanceof pf1.documents.item.ItemPF)) return;
  // Skip items that were removed as part of the actor's own deletion.
  if (actorsBeingDeleted.has(item.actor.id)) return;

  item
    .executeScriptCalls(CATEGORY_DELETE, { options, userId }, {})
    .catch((err) => console.error(`${MODULE_ID} | delete script call failed on "${item.name}":`, err));
});

})();
