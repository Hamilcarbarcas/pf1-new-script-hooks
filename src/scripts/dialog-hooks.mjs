/*
 * Dialog Hooks
 *
 * Wraps ActionUse.prototype.createAttackDialog to fire custom hooks
 * around the PF1 attack dialog:
 *  - pf1PreAttackDialog(actionUse, promises)
 *  - pf1AttackDialogResolved(actionUse, formData, promises)
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
 *
 * Between the two, once the form is known:
 *  - pf1AttackDialogResolved(actionUse, formData, promises)
 *    Fires before pf1PostAttackDialog. Setting shared.reject here aborts the
 *    action the same way the dialog's close button does: no Pre-Use, no charge
 *    deduction, no card. A module that defers a use to a later point splits it
 *    here, with the options chosen but nothing yet spent or rolled.
 *
 * Resuming a use whose options were chosen earlier:
 *  - shared.resumeForm = {...}  Set before the dialog would open (e.g. from
 *                              pf1CreateActionUse). Skips pf1PreAttackDialog,
 *                              the dialog and pf1AttackDialogResolved, then
 *                              fires pf1PostAttackDialog with a copy of the form.
 *                              Pre-Activate does not run again; Pre-Use does.
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

/** Fire a hook with a promises array and await what its listeners pushed. */
async function fireAwaited(hookName, ...args) {
  const promises = [];
  try {
    Hooks.callAll(hookName, ...args, promises);
  } catch (err) {
    console.error(`${MODULE_ID} | Error in ${hookName} hook:`, err);
  }
  if (promises.length) {
    await Promise.all(promises);
  }
}

/**
 * Show the dialog (or skip it) with the pre hook and the resolved hook around it.
 *
 * @this {ActionUse}
 * @returns {Promise<object|null>} The form, or null when the action is cancelled.
 */
async function chooseForm(wrapped, args) {
  const shared = this.shared;

  await fireAwaited("pf1PreAttackDialog", this);

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

  await fireAwaited("pf1AttackDialogResolved", this, form);
  if (shared.reject) return null;

  return form;
}

async function createAttackDialogWrapper(wrapped, ...args) {
  // A resumed use already chose its options; Pre-Activate and the dialog are not repeated.
  // Copied, because alterRollData fills defaults into the form it is given.
  const resumed = this.shared.resumeForm;
  const form = resumed ? foundry.utils.deepClone(resumed) : await chooseForm.call(this, wrapped, args);
  if (!form) return form;

  await fireAwaited("pf1PostAttackDialog", this, form);

  return form;
}

})();
