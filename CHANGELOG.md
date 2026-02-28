# Changelog

## [1.0.0] - 2026-02-28

### Added
- `pf1PreAttackDialog` hook fires before the PF1 attack dialog opens, with an awaitable `promises` array for async handlers.
- `pf1PostAttackDialog` hook fires after the attack dialog closes and before roll calculations, also with an awaitable `promises` array.
- **Pre-Activate** script call category: runs before the attack dialog opens.
- **Pre-Use** script call category: runs after the attack dialog closes and before roll calculations.
- Pre-Activate and Pre-Use categories are sorted to the top of the item sheet script calls UI for visibility.
- Requires [libWrapper](https://foundryvtt.com/packages/lib-wrapper) and the [PF1 system](https://foundryvtt.com/packages/pf1).
- Compatible with FoundryVTT v13.
