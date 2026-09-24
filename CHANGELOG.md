# Changelog

## [Unreleased]

### Added
- **Per Use (`perUse`)** script call category, item-level and action-scoped. Fires **once per attack or use on the card** instead of once per action: four iteratives fire it four times, an action repeating itself without attack rolls fires it once per use, and an action that resolves once fires it once — so one script covers every case. In scope alongside the usual variables is `use` = `{ index, total, chatAttack, sequential }`.
  It rides the existing `use` pass rather than taking a libWrapper of its own — by then the rows are rolled, their effect notes are in and the footnotes are built, and `ActionUse.executeScriptCalls` is already wrapped here, so no second registration was needed. **Errors are logged, not rethrown**, diverging from `use` on purpose: this category fires repeatedly *during* resolution with rolls already made, and aborting on the third of five would leave a half-resolved action. `shared.reject` is the deliberate exit and is honoured between rows.
  Published as `game.modules.get("pf1-new-script-hooks").api.runPerUse(actionUse, { index, total, chatAttack, sequential })` for modules that resolve their own use loop and never reach the row pass — pf1-sequential-attacks posts a card per attack and drives the category itself, so `use.index` runs 0..n-1 identically whether attacks resolve together or one at a time. Optional on both sides; neither module requires the other.
  In the item sheet Script Calls list it is ordered immediately before Post-Use, next to the category it splits.

### Fixed
- **The action sheet's Script Calls section now sits at the bottom of the Misc tab** instead of landing among other modules' sections, where it split astora-mod's Target Filter from the targeting controls that go with it. Before, its render hook was registered at load time, so its position followed module load order. It is now registered at `ready`, which puts it after every load-time hook. Sections that place themselves asynchronously, such as astora-mod's Buff Delivery, still land below it.

## [1.5.0] - 2026-09-21

### Added
- **Chat Button (`chatButton`)** script call category. Nothing in this module fires it: it is a hook point that astora-mod's Action Buttons dispatches into when a chat-card button of type `script-call` aimed at the item is pressed, and the category exists so the list is editable on the item sheet like any other. It closes the one gap an item script could not close for itself — a script call can't register a durable button handler, because a handler lives in memory on one client, but it *can* ask for a button whose descriptor names a category, and the descriptor is stored on the message. Scripts get `message`, `data` and `button` on top of the standard scope, and answer back through `shared.remove`, which overrides the descriptor's own `once` setting in both directions — the seam for "the run decided it had nothing to do". **Soft dependency** on astora-mod, the same shape as Rest End: with it absent nothing could ever press such a button, so the category is not registered rather than offered as a list that silently never runs. (New `button-hooks.mjs`.)

## [1.4.0] - 2026-09-21

### Added
- **Rest End (`restEnd`)** script call category. Fires on every item a resting actor carries when a rest ends, bridging astora-mod's `astoraRestEnded` hook. Fires for *every* ending — a long rest that resolved, one the GM abandoned partway, one cancelled outright, and both outcomes of a short rest — with a `rest` record in scope carrying `type`, `resolved`, `outcome`, `plannedSeconds`, `elapsedSeconds`, `actors`, `caredFor`, `config`, `reason` and `endedAt`, so a script gates on what it actually cares about rather than the category guessing for it. **Soft dependency**: with astora-mod absent the category is not registered at all, since a category that can never fire invites scripts that silently never run. astora-mod fires its hook on every client, so execution is gated on `actor.activeOwner.isSelf` — the same gate `combat-hooks.mjs` uses — giving exactly one client per actor and the permissions to write to it. Only active items fire it, as with Turn Start / Turn End. A failing script is logged and the next actor still runs: unlike a use, there is nothing left to cancel once a rest has ended, so letting one item's error strip the rest of the party of theirs would be pure loss. (New `rest-hooks.mjs`.)

### Changed
- **Both Script Calls sections are now collapsible.** The item sheet's own section on the Advanced tab and the action-scoped one on the Misc tab each collapse by clicking their `h3.form-header`: the heading is the control, a `</>` icon paired with the title is the state cue (full when open, dimmed when closed), and a badge at the right edge carries the script count so it stays readable while shut. A section defaults to open **only when it holds at least one script** — most items and actions script nothing and now cost a line of the tab rather than a screen of it. Expanded state lives in memory for as long as the sheet is open and nothing is written to the document, so opening an item to look at it still writes nothing. The badge counts rendered rows rather than stored scripts, so it never tells a player how many hidden entries they cannot see. Clicks on the help link, the **+** controls and the hidden toggles inside the heading fall through as before.

  Note that the item sheet's section is **PF1's own**, not one this module injects — collapsing it is deliberate, since it shares the Advanced tab with the sections other modules append and was usually the tallest thing there.

  The mechanism is the vendored sheet kit (`src/common/sheet/collapse.mjs` + `kit.css`, prefix `nsh-`), the same copy the other modules here use, added via a new `common.json`. The action sheet's markup gained a `div.nsh-collapse-body` wrapper; the item sheet's is wrapped at render time. PF1 binds its own script-call listeners with descendant selectors directly on the matched elements, so moving them into that wrapper leaves them live. (New `script-calls-collapse.mjs`.)

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
