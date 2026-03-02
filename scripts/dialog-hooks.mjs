/*
 * Dialog Hooks
 *
 * Wraps ActionUse.prototype.createAttackDialog to fire two custom hooks
 * around the PF1 attack dialog:
 *  - pf1PreAttackDialog(actionUse, promises)
 *  - pf1PostAttackDialog(actionUse, formData, promises)
 *
 * These fire immediately before the attack dialog opens and immediately
 * after it closes (before alterRollData runs in ActionUse.process).
 *
 * The `promises` array allows async handlers to push promises that will
 * be awaited before the wrapper continues, ensuring all modifications
 * complete before the form data is consumed by alterRollData or other modules.
 *
 * Sync handlers can simply ignore the extra argument.
 *
 * Pre-Activate Script Call API (via shared object):
 *  - shared.reject = true     Cancels the action entirely. The attack dialog
 *                              is never shown, createAttackDialog returns null,
 *                              and ActionUse.process() aborts.
 *  - shared.skipDialog = true  Skips the attack dialog but continues the action.
 *                              createAttackDialog returns an empty form object
 *                              and ActionUse.process() proceeds with defaults.
 */

(() => {
"use strict";

const MODULE_ID = "pf1-new-script-hooks";

Hooks.once("ready", () => {
  if (!game.modules.get("lib-wrapper")?.active) {
    console.warn(`${MODULE_ID} | libWrapper is required. Feature disabled.`);
    return;
  }

  libWrapper.register(
    MODULE_ID,
    "pf1.actionUse.ActionUse.prototype.createAttackDialog",
    createAttackDialogWrapper,
    "MIXED"
  );

  console.log(`${MODULE_ID} | Dialog hooks wrapper registered.`);
});

async function createAttackDialogWrapper(wrapped, ...args) {
  const shared = this.shared;
  const prePromises = [];
  try {
    Hooks.callAll("pf1PreAttackDialog", this, prePromises);
  } catch (err) {
    console.error(`${MODULE_ID} | Error in pf1PreAttackDialog hook:`, err);
  }
  if (prePromises.length) {
    await Promise.all(prePromises);
  }

  // Cancel: preActivate script set shared.reject — abort without showing dialog
  if (shared.reject) {
    console.log(`${MODULE_ID} | Action cancelled by preActivate script call.`);
    return null;
  }

  // Skip dialog: preActivate script set shared.skipDialog — continue with defaults
  if (shared.skipDialog) {
    console.log(`${MODULE_ID} | Attack dialog skipped by preActivate script call.`);
    return {};
  }

  const form = await wrapped(...args);

  if (form) {
    const postPromises = [];
    try {
      Hooks.callAll("pf1PostAttackDialog", this, form, postPromises);
    } catch (err) {
      console.error(`${MODULE_ID} | Error in pf1PostAttackDialog hook:`, err);
    }
    if (postPromises.length) {
      await Promise.all(postPromises);
    }
  }

  return form;
}

})();
