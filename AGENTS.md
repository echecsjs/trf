# AGENTS.md

Agent guidance for the `@echecs/trf` package — FIDE Tournament Report File (TRF)
parser.

**See also:** [`REFERENCES.md`](REFERENCES.md) |
[`COMPARISON.md`](COMPARISON.md) | [`SPEC.md`](SPEC.md)

See the root `AGENTS.md` for workspace-wide conventions (package manager,
TypeScript settings, formatting, naming, testing, ESLint rules).

**Backlog:** tracked in [GitHub Issues](https://github.com/mormubis/trf/issues).

---

## Project Overview

Parser and serializer library, no runtime dependencies. Named exports:
`parse(input, options?) → Tournament | null` and
`stringify(tournament, options?) → string`. Never throws; parse failures return
`null` and call `options.onError`. Recoverable issues emit `options.onWarning`.

Mirrors the API style of `@echecs/pgn`.

---

## Commands

### Build

```bash
pnpm run build          # bundle → dist/
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

## Architecture Notes

- **ESM-only** — the package ships only ESM. Do not add a CJS build.
- No runtime dependencies — keep it that way.
- `parse()` is synchronous — do not introduce async.
- `src/index.ts` is a re-export barrel. Logic lives in `src/parse.ts` and
  `src/stringify.ts`.
- `src/columns.ts` contains shared column offset constants.
- `src/types.ts` contains all exported types.
- All interface fields sorted alphabetically (`sort-keys` is an ESLint error).
- Always use `.js` extensions on relative imports (NodeNext resolution).

---

## Validation

Input validation is mostly provided by TypeScript's strict type system at
compile time. There is no runtime validation library — the type signatures
enforce correct usage. Do not add runtime type-checking guards (e.g. `typeof`
checks, assertion functions) unless there is an explicit trust boundary.

---

## Error Handling

- Returns `null` for unrecoverable failures; calls `options.onError`.
- Emits `options.onWarning` for recoverable issues (unknown tags, malformed
  rating, unknown result code).
- Never throws.

---

## Release Protocol

Step-by-step process for releasing a new version. CI auto-publishes to npm when
`version` in `package.json` changes on `main`.

1. **Verify the package is clean:**

   ```bash
   pnpm lint && pnpm test && pnpm build
   ```

   Do not proceed if any step fails.

2. **Decide the semver level:**
   - `patch` — bug fixes, internal refactors with no API change
   - `minor` — new features, new exports, non-breaking additions
   - `major` — breaking changes to the public API

3. **Update `CHANGELOG.md`** following
   [Keep a Changelog](https://keepachangelog.com) format:

   ```markdown
   ## [x.y.z] - YYYY-MM-DD

   ### Added

   - …

   ### Changed

   - …

   ### Fixed

   - …

   ### Removed

   - …
   ```

   Include only sections that apply. Use past tense.

4. **Update `README.md`** if the release introduces new public API, changes
   usage examples, or deprecates/removes existing features.

5. **Bump the version:**

   ```bash
   npm version <major|minor|patch> --no-git-tag-version
   ```

6. **Commit and push:**

   ```bash
   git add package.json CHANGELOG.md README.md
   git commit -m "release: @echecs/trf@x.y.z"
   git push
   ```

   **The push is mandatory.** The release workflow only triggers on push to
   `main`. A commit without a push means the release never happens.

7. **CI takes over:** GitHub Actions detects the version bump, runs format →
   lint → test, and publishes to npm.

Do not manually publish with `npm publish`.
