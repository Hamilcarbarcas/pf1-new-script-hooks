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
 * They also fire when the dialog is skipped entirely (shift-click, the
 * "skip action prompt" setting, or `skipDialog: true`). ActionUse.process only
 * calls createAttackDialog when its own skipDialog option is false, so a
 * wrapper on ActionUse.process moves that skip onto `shared.skipDialog` — which
 * this wrapper honors *after* the hooks have run. process() reads the option
 * nowhere else, so nothing but the hook timing changes.
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

  libWrapper.register(MODULE_ID, "pf1.actionUse.ActionUse.prototype.process", processWrapper, "WRAPPER");

  console.log(`${MODULE_ID} | Dialog hooks wrapper registered.`);
});

/**
 * Ensure createAttackDialog is always reached, so the hooks fire even when the
 * dialog itself is suppressed.
 *
 * @this {ActionUse}
 * @param {Function} wrapped - Wrapped function
 * @param {...*} args - Wrapped arguments
 * @returns {Promise<*>} - Wrapped result
 */
async function processWrapper(wrapped, ...args) {
  const options = args[0];
  if (options?.skipDialog) {
    // shared.skipDialog already carries the same value (ItemPF#use puts it
    // there), but set it explicitly so any other caller behaves the same.
    this.shared.skipDialog = true;
    args[0] = { ...options, skipDialog: false };
  }

  return wrapped(...args);
}

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

  let form;

  // Skip dialog: requested by the caller or by a preActivate script — continue
  // with defaults, but still run the post hooks so preUse gets its turn.
  if (shared.skipDialog) {
    form = {};
  }
  // Normal path
  else {
    form = await wrapped(...args);
    if (!form) return form; // Dialog closed/cancelled by the user
  }

  const postPromises = [];
  try {
    Hooks.callAll("pf1PostAttackDialog", this, form, postPromises);
  } catch (err) {
    console.error(`${MODULE_ID} | Error in pf1PostAttackDialog hook:`, err);
  }
  if (postPromises.length) {
    await Promise.all(postPromises);
  }

  return form;
}

})();
