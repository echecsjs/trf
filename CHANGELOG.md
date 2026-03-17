# Changelog

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
