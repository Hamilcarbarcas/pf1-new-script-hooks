/*
 * Toggle Hooks
 *
 * Wraps ItemBuffPF._preUpdate to fire a preToggle script call before a buff's
 * active state is committed to the database. Returning false from _preUpdate
 * cancels the update, so setting shared.reject = true in the script prevents
 * the toggle from happening.
 *
 * Fires for both turning on and off. Scripts receive:
 *  - extraParams.state  : boolean — the new active state being applied
 *  - extraParams.reason : string | null — "duration" when fired by expiration,
 *                         null for manual toggles or direct item.update() calls
 *
 * Pre-Toggle Script Call API (via shared object):
 *  - shared.reject = true  Cancels the toggle. The buff's active state is not
 *                          changed and _onUpdate / the toggle script call never fire.
 */

(() => {
"use strict";

const MODULE_ID = "pf1-new-script-hooks";
const CATEGORY_PRE_TOGGLE = "preToggle";

Hooks.once("ready", () => {
  if (!game.modules.get("lib-wrapper")?.active) {
    console.warn(`${MODULE_ID} | libWrapper is required for toggle hooks. Feature disabled.`);
    return;
  }

  libWrapper.register(
    MODULE_ID,
    "pf1.documents.item.ItemBuffPF.prototype._preUpdate",
    preUpdateWrapper,
    "WRAPPER"
  );

  console.log(`${MODULE_ID} | Toggle hooks registered.`);
});

async function preUpdateWrapper(wrapped, changed, context, user) {
  const result = await wrapped(changed, context, user);

  const newState = changed.system?.active;
  if (newState === undefined) return result;
  if (context.diff === false || context.recursive === false) return result;

  const reason = context.pf1?.reason ?? null;
  const shared = {};

  await this.executeScriptCalls(CATEGORY_PRE_TOGGLE, { state: newState, reason }, shared);

  if (shared.reject) return false;
  return result;
}

})();
