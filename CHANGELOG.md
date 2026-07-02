# Changelog

## [1.2.0] - 2026-07-02

### Added
- **Create** script call category: runs once when an item is added to an actor (e.g. dropped from a compendium). Fires on the dropper's client via Foundry's native `createItem` hook, for actor-embedded items only. Scripts receive the standard `item`, `actor`, `token` variables plus the creation `options` and `userId`. Items that arrive as part of a whole actor being created, imported, or duplicated are filtered out.

## [1.0.0] - 2026-02-28

### Added
- `pf1PreAttackDialog` hook fires before the PF1 attack dialog opens, with an awaitable `promises` array for async handlers.
- `pf1PostAttackDialog` hook fires after the attack dialog closes and before roll calculations, also with an awaitable `promises` array.
- **Pre-Activate** script call category: runs before the attack dialog opens.
- **Pre-Use** script call category: runs after the attack dialog closes and before roll calculations.
- Pre-Activate and Pre-Use categories are sorted to the top of the item sheet script calls UI for visibility.
- Requires [libWrapper](https://foundryvtt.com/packages/lib-wrapper) and the [PF1 system](https://foundryvtt.com/packages/pf1).
- Compatible with FoundryVTT v13.
