# Changelog

## 0.5.1 — 2026-03-17

- Treat rating `0` as unrated (`undefined`) rather than a warning — `0` is the
  JaVaFo convention for unrated players

## 0.5.0 — 2026-03-17

**Breaking change:** `Sex` type changed from `'f' | 'm'` to `'m' | 'w'` to match
the TRF16 spec (`w` = woman, not `f`). Any code checking `sex === 'f'` must be
updated to `sex === 'w'`.

- Fix `Sex` type: `'f'` → `'w'` (TRF16 spec uses `m`/`w`, not `m`/`f`)
- Map JaVaFo single-letter title codes: `g`→`GM`, `m`→`IM`, `f`→`FM`, `w`→`WIM`
- Add real-world fixture tests:
  - JaVaFo TRFXSample2 (52 players, Spanish open 2010, freely distributed)
  - FIDE TEC GrandMommysCup TRF25 sample (249 players, 50 teams, 14 rounds)
- 29 new tests — 92 total

## 0.4.0 — 2026-03-17

- Add tests for all optional player fields: `sex`, `title`, `fideId`,
  `birthDate`, `federation`
- Verify correct column offsets for all fields with a fully-populated test line
- Test blank field → `undefined` and invalid values → `undefined` for sex/title

## 0.3.0 — 2026-03-17

- `ParseError` and `ParseWarning` now report accurate `line`, `column`, and
  `offset` positions instead of stubs
- Added named column constants for all `001` player line fields
- Added position-accuracy tests for errors and warnings

## 0.2.2 — 2026-03-17

- Consolidate infrastructure fixes into a single published version

## 0.2.1 — 2026-03-17

- Fix CI formatting failures by adding `prettier.config.mjs` and
  `.prettierignore`

## 0.2.0 — 2026-03-17

- Add README with usage examples, type reference, and result code table
