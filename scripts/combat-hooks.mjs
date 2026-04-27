/*
 * Combat Hooks
 *
 * Wraps CombatPF._processTurnStart and CombatPF._processEndTurn to execute
 * script calls on the active combatant's items at turn start and turn end.
 *
 *  - turnStart -> fires after PF1's own turn-start processing (effect expiration, recharge)
 *  - turnEnd   -> fires after PF1's own turn-end processing (effect expiration)
 *
 * Runs on the same user as PF1's own processing (actor.activeOwner.isSelf),
 * so GM/player ownership is handled correctly with no double-execution.
 */

(() => {
"use strict";

const MODULE_ID = "pf1-new-script-hooks";
const CATEGORY_TURN_START = "turnStart";
const CATEGORY_TURN_END = "turnEnd";

Hooks.once("ready", () => {
  if (!game.modules.get("lib-wrapper")?.active) {
    console.warn(`${MODULE_ID} | libWrapper is required for combat hooks. Feature disabled.`);
    return;
  }

  libWrapper.register(
    MODULE_ID,
    "pf1.documents.CombatPF.prototype._processTurnStart",
    processTurnStartWrapper,
    "WRAPPER"
  );

  libWrapper.register(
    MODULE_ID,
    "pf1.documents.CombatPF.prototype._processEndTurn",
    processEndTurnWrapper,
    "WRAPPER"
  );

  console.log(`${MODULE_ID} | Combat hooks registered.`);
});

async function processTurnStartWrapper(wrapped, changed, context) {
  await wrapped(changed, context);

  const combatant = this.combatant;
  const actor = combatant?.actor;
  if (!actor) return;
  if (!actor.activeOwner?.isSelf) return;

  const combat = this;
  const shared = { combat, combatant, actor };
  const extraParams = { combat, combatant, turn: this.turn, round: this.round };

  for (const item of actor.items) {
    try {
      await item.executeScriptCalls(CATEGORY_TURN_START, extraParams, shared);
    } catch (err) {
      console.error(`${MODULE_ID} | turnStart script call failed on "${item.name}":`, err);
    }
  }
}

async function processEndTurnWrapper(wrapped, originTime = {}, context = {}) {
  await wrapped(originTime, context);

  const { turn, round } = originTime;
  const combatant = this.turns.at(turn);
  const actor = combatant?.actor;
  if (!actor) return;
  if (!actor.activeOwner?.isSelf) return;

  const combat = this;
  const shared = { combat, combatant, actor };
  const extraParams = { combat, combatant, turn, round };

  for (const item of actor.items) {
    try {
      await item.executeScriptCalls(CATEGORY_TURN_END, extraParams, shared);
    } catch (err) {
      console.error(`${MODULE_ID} | turnEnd script call failed on "${item.name}":`, err);
    }
  }
}

})();
