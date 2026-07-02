/*
 * Create Hooks
 *
 * Fires a `create` script call the moment an item is embedded on an actor —
 * e.g. dragged onto a sheet from a compendium or the sidebar, or added
 * programmatically. Uses Foundry's native `createItem` hook, so no libWrapper
 * wrapping is needed.
 *
 * Runs once, on the client of the user who created the item (the dropper), and
 * only for actor-embedded items (world items are ignored).
 *
 * The script call runner supplies `item`, `actor`, and `token` automatically
 * (derived from the item's parent). In addition this hook passes:
 *  - extraParams.options : the creation options object
 *  - extraParams.userId  : the id of the user who created the item
 *
 * Bulk-creation guard: when a whole actor is created, imported, or duplicated,
 * its embedded items also fire `createItem`. We do NOT want the `create` script
 * to run for those — only for items deliberately added to an already-existing
 * actor. We track actors that are mid-creation and skip their items. The actor's
 * own create hook fires in the same synchronous batch as its items' hooks, so we
 * register the id when the actor is (pre)created and release it on the next tick,
 * after that batch has drained but before any later manual drop.
 *
 * Residual edge: re-importing data onto an *existing* actor can delete and
 * recreate its items without re-creating the actor, which would fire `create`.
 * That is rare; guard inside the script if it matters for your use case.
 */

(() => {
"use strict";

const MODULE_ID = "pf1-new-script-hooks";
const CATEGORY_CREATE = "create";

// Ids of actors currently being created/imported/duplicated.
const actorsBeingCreated = new Set();

const markActorCreating = (actor) => {
  if (actor?.id) actorsBeingCreated.add(actor.id);
};

// Register as early as possible so a child createItem can never sneak in first...
Hooks.on("preCreateActor", markActorCreating);

// ...and again on create (id is guaranteed stable here), then release on the next
// macrotask once this operation's synchronous descendant item hooks have run.
Hooks.on("createActor", (actor) => {
  markActorCreating(actor);
  setTimeout(() => actorsBeingCreated.delete(actor.id), 0);
});

Hooks.on("createItem", (item, options, userId) => {
  // Only the initiating client runs it (the user who dropped the item).
  if (game.user.id !== userId) return;
  // Actor-embedded items only; skip world/compendium-directory items.
  if (!item.actor) return;
  if (!(item instanceof pf1.documents.item.ItemPF)) return;
  // Skip items that arrived as part of the actor's own creation/import.
  if (actorsBeingCreated.has(item.actor.id)) return;

  item
    .executeScriptCalls(CATEGORY_CREATE, { options, userId }, {})
    .catch((err) => console.error(`${MODULE_ID} | create script call failed on "${item.name}":`, err));
});

})();
