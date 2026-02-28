# PF1e New Script Hooks

A Foundry VTT module for the PF1 system that adds new hook points and script call categories around the attack dialog lifecycle.

**Version:** 1.0.0  
**Foundry VTT Compatibility:** v13  
**Manifest URL:** `https://github.com/Hamilcarbarcas/pf1-new-script-hooks/releases/latest/download/module.json`

## Features

### Dialog Hooks

Wraps `ActionUse.prototype.createAttackDialog` to fire two new hooks:

- **`pf1PreAttackDialog(actionUse, promises)`** — Fires immediately before the attack dialog opens.
- **`pf1PostAttackDialog(actionUse, formData, promises)`** — Fires immediately after the attack dialog closes, before `alterRollData` processes the form data.

Both hooks pass a `promises` array as the last argument. Async handlers can push a promise into this array and the wrapper will `await Promise.all(promises)` before continuing, ensuring all modifications complete before the form data is consumed. Synchronous handlers can simply ignore the extra argument.

### Script Call Categories

Registers two new script call categories with the PF1 script call system:

- **Pre-Activate** (`preActivate`) — Runs before the attack dialog opens. Use this for setup logic that needs to happen before the user sees the dialog (e.g. toggling flags, modifying use options).
- **Pre-Use** (`preUse`) — Runs after the attack dialog closes and before roll calculations begin. Use this to modify `formData` based on the user's dialog choices (e.g. setting `power-attack`, injecting bonuses).

These categories appear at the top of the script calls list on item sheets for easy access.

## Compatibility

- **Minimum Foundry Version**: 13
- **Verified Version**: 13
- **Required Dependencies**:
  - **libWrapper** (https://github.com/ruipin/fvtt-lib-wrapper)
  - **Pathfinder 1e** system
