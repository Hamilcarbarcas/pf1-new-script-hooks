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
    "WRAPPER"
  );

  console.log(`${MODULE_ID} | Dialog hooks wrapper registered.`);
});

async function createAttackDialogWrapper(wrapped, ...args) {
  const prePromises = [];
  try {
    Hooks.callAll("pf1PreAttackDialog", this, prePromises);
  } catch (err) {
    console.error(`${MODULE_ID} | Error in pf1PreAttackDialog hook:`, err);
  }
  if (prePromises.length) {
    await Promise.all(prePromises);
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
