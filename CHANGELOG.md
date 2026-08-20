# Changelog

## [1.3.0] - 2026-08-19

### Fixed
- **Pre-Activate and Pre-Use now fire when the attack dialog is skipped.** `ActionUse.process` only calls `createAttackDialog` — the module's sole hook point — when its own `skipDialog` option is false, so shift-clicking, the *Skip action prompt* setting, or `skipDialog: true` silently bypassed both categories and both `pf1PreAttackDialog` / `pf1PostAttackDialog`. A `WRAPPER` on `ActionUse.process` now moves that skip onto `shared.skipDialog`, which the dialog wrapper already honored after running the hooks; `process()` reads the option nowhere else, so only the hook timing changes. `pf1PostAttackDialog` and Pre-Use receive an empty form object on the skipped path, and `shared.reject` still cancels from either category.

### Added
- **Action-scoped script calls.** Each action sheet now has its own Script Calls section at the bottom of the Misc tab, offering **Pre-Activate**, **Pre-Use**, **Use** and **Post-Use**. Scripts placed there fire only when that action is used, while the item-level lists keep firing for every action; both share one `shared` object and the item-level list runs first. Full parity with the item sheet's lists: create/edit/delete, the GM hidden toggle, right-click to edit, and macro drag-and-drop (which also installs its own `dragover` handler, since the action sheet's `DragDrop` only marks the conditionals tab as a drop target). Use/Post-Use are driven by a `WRAPPER` on `ActionUse.executeScriptCalls`, Pre-Activate/Pre-Use are chained onto the existing dialog hook handlers so ordering against the item-level lists is deterministic. Entries are stored on the parent item under a synthetic `action:<actionId>:<category>` category (PF1 actions have a closed schema with no flags), hidden from the item sheet's own section, cleaned up when the action is deleted, and copied when an action is duplicated. (New `action-script-calls.mjs`.)

## [1.2.0] - 2026-07-14

### Added
- **Delete (`delete`)** script call category. Fires once when an item is removed from an actor (e.g. deleted from the sheet) via Foundry's native `deleteItem` hook, on the deleting user's client. The mirror image of `create`. Scripts receive the standard `item`, `actor`, and `token` plus the deletion `options` and `userId`; the item is detached but fully readable, and the actor's item collection already reflects the removal. Items removed as part of a whole actor being deleted are filtered out. (New `delete-hooks.mjs`.)

## [1.1.0] - 2026-07-02

### Changed
- **Loaded as ES modules.** `module.json` now registers the scripts under `esmodules` instead of `scripts`. Each file runs in its own module scope rather than the shared global scope, matching how the PF1 system and other modern modules load.

### Added
- **Turn Start (`turnStart`)** and **Turn End (`turnEnd`)** script call categories. Fire on the active combatant's items at the start/end of its combat turn, after PF1's own turn processing, on the actor's active-owning client. Only active items fire them. (New `combat-hooks.mjs`, wrapping `CombatPF._processTurnStart` / `_processEndTurn`.)
- **Pre-Toggle (`preToggle`)** script call category for buffs. Fires before a buff's active state is written to the database — catching manual toggles, `setActive()`, and duration-based expiration. Set `shared.reject = true` to cancel the toggle before it commits. (New `toggle-hooks.mjs`, wrapping `ItemBuffPF._preUpdate`.)
- **Create (`create`)** script call category. Fires once when an item is added to an existing actor (e.g. dropped from a compendium or the sidebar) via Foundry's native `createItem` hook, on the dropper's client. Scripts receive the standard `item`, `actor`, and `token` plus the creation `options` and `userId`. Items that arrive as part of a whole actor being created, imported, or duplicated are filtered out. (New `create-hooks.mjs`.)

### Fixed
- Script call category ordering on the item sheet: Pre-Activate and Pre-Use are pinned to the top, and Pre-Toggle is inserted immediately before the built-in Toggle category.

## [1.0.2] - 2026-03-28

### Changed
- README updates.

## [1.0.1] - 2026-03-28

### Added
- `shared.reject` and `shared.skipDialog` controls for the Pre-Activate / Pre-Use categories, letting scripts cancel an action or skip the attack dialog.

## [1.0.0] - 2026-02-28

### Added
- `pf1PreAttackDialog` hook fires before the PF1 attack dialog opens, with an awaitable `promises` array for async handlers.
- `pf1PostAttackDialog` hook fires after the attack dialog closes and before roll calculations, also with an awaitable `promises` array.
- **Pre-Activate** script call category: runs before the attack dialog opens.
- **Pre-Use** script call category: runs after the attack dialog closes and before roll calculations.
- Pre-Activate and Pre-Use categories are sorted to the top of the item sheet script calls UI for visibility.
- Requires [libWrapper](https://foundryvtt.com/packages/lib-wrapper) and the [PF1 system](https://foundryvtt.com/packages/pf1).
- Compatible with FoundryVTT v13.
