# AGENTS.md

Agent guidance for the `@echecs/trf` package — FIDE Tournament Report File (TRF)
parser.

See the root `AGENTS.md` for workspace-wide conventions (package manager,
TypeScript settings, formatting, naming, testing, ESLint rules).

---

## Project Overview

Pure parser library, no runtime dependencies. Default export:
`parse(input, options?) → Tournament | null`. Never throws; returns `null` on
failure and calls `options.onError`. Recoverable issues emit
`options.onWarning`.

Mirrors the API style of `@echecs/pgn`.

---

## Commands

### Build

```bash
pnpm run build          # compile TypeScript → dist/
```

### Test

```bash
pnpm run test                          # run all tests once
pnpm run test:watch                    # watch mode
pnpm run test:coverage                 # with coverage report
pnpm run test src/__tests__/index.spec.ts  # single file
```

### Lint & Format

```bash
pnpm run lint           # ESLint + tsc type-check (auto-fixes style)
pnpm run lint:ci        # strict — zero warnings, no auto-fix
pnpm run lint:style     # ESLint only
pnpm run lint:types     # tsc --noEmit only
pnpm run format         # Prettier (writes)
pnpm run format:ci      # Prettier check only
```

### Full pre-PR check

```bash
pnpm lint && pnpm test && pnpm build
```

---

## TRF Format Reference

TRF (Tournament Report File) is the FIDE interchange format for pairing
software.

Column layout of a `001` player line (0-indexed):

- 0–2: record type (`001`)
- 4–7: pairing number
- 9: sex (`m`/`w`)
- 10–13: FIDE title
- 15–46: player name
- 48–51: FIDE rating
- 53–55: federation
- 57–68: FIDE player ID
- 70–79: date of birth
- 80–83: points
- 84–88: rank
- 91+: round results, 10 chars each (`   O c r  `)

Header tag prefixes: `012` name, `022` city, `032` federation, `042` start date,
`052` end date, `092` chief arbiter, `112` time control, `XXR` rounds.

`XXR` stores the total planned round count as a plain integer after the tag
prefix, e.g. `XXR 9`. All other `NNN`-style tags store free-form text after a
space.

Result codes: `1` win, `0` loss, `=` draw, `+` forfeit win, `-` forfeit loss,
`F` full-point bye, `H` half-point bye, `U` unplayed, `Z` zero-point bye.

---

## Architecture Notes

- No runtime dependencies — keep it that way.
- `parse()` is synchronous — do not introduce async.
- `src/index.ts` contains both the implementation and public re-exports.
- `src/types.ts` contains all exported types.
- All interface fields sorted alphabetically (`sort-keys` is an ESLint error).
- Always use `.js` extensions on relative imports (NodeNext resolution).

---

## Error Handling

- Returns `null` for unrecoverable failures; calls `options.onError`.
- Emits `options.onWarning` for recoverable issues (unknown tags, malformed
  rating, unknown result code).
- Never throws.

---

## Publishing

Published as `@echecs/trf`. GitHub Actions auto-publishes on `version` bump in
`package.json` on `main`. Always update `CHANGELOG.md` with version bumps. Bump
patch for fixes, minor for new features, major for breaking changes.
