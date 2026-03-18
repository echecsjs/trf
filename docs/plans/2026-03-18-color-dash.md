# RoundResult color `-` Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Preserve the TRF `-` color byte in `RoundResult.color` instead of
normalising it to `'b'`, so byes and unplayed entries roundtrip faithfully.

**Architecture:** Single-line type change in `src/types.ts`, single-line parser
change in `src/parse.ts` removing the normalisation, no change to
`src/stringify.ts`. Tests updated to assert `-` where fixtures have it.

**Tech Stack:** TypeScript, Vitest. No new dependencies.

---

## Task 1: Update `RoundResult.color` type and parser

**Files:**

- Modify: `src/types.ts`
- Modify: `src/parse.ts`

### Step 1: Write failing tests

Add to `src/__tests__/index.spec.ts`, inside the existing
`describe('parse — round results', ...)` block:

```ts
it('preserves - color for half-point bye', () => {
  const playerLine =
    '001    1      Test0001 Player0001               2720                             1.0    1  0000 - H  ';
  const result = parse(`012 T\nXXR 1\n${playerLine}\n`);
  const r = result?.players[0]?.results[0];
  expect(r?.color).toBe('-');
  expect(r?.result).toBe('H');
  expect(r?.opponentId).toBeNull();
});

it('preserves - color for zero-point bye', () => {
  const playerLine =
    '001    1      Test0001 Player0001               2720                             0.0    1  0000 - Z  ';
  const result = parse(`012 T\nXXR 1\n${playerLine}\n`);
  const r = result?.players[0]?.results[0];
  expect(r?.color).toBe('-');
  expect(r?.result).toBe('Z');
});
```

Also update the existing Z-bye fixture test to assert `color`:

Find this test:

```ts
it('parses Z-bye with opponentId null', () => {
  const result = parse(fixture('dutch_2025_C5'));
  const p4 = result?.players[3];
  const zBye = p4?.results.find((r) => r.result === 'Z');
  expect(zBye).toBeDefined();
  expect(zBye?.opponentId).toBeNull();
});
```

Add one line to it:

```ts
expect(zBye?.color).toBe('-');
```

And update the `javafo_sample2` H-bye test to assert `color`:

Find:

```ts
it('parses H (half-point bye) result code', () => {
  // P14 (index 13) has an H bye in round 3
  const p14 = parse(fixture('javafo_sample2'))?.players[13];
  const hBye = p14?.results.find((r) => r.result === 'H');
  expect(hBye).toBeDefined();
  expect(hBye?.opponentId).toBeNull();
});
```

Add:

```ts
expect(hBye?.color).toBe('-');
```

### Step 2: Run to confirm they fail

```bash
pnpm run test src/__tests__/index.spec.ts
```

Expected: the two new unit tests FAIL (color is currently `'b'`), the updated
fixture assertions FAIL.

### Step 3: Update `src/types.ts`

Change `RoundResult.color`:

```ts
interface RoundResult {
  color: 'b' | 'w' | '-';
  opponentId: number | null;
  result: ResultCode;
  round: number;
}
```

### Step 4: Update `src/parse.ts`

Find line 223–224:

```ts
// '-' is the TRF marker for byes (no color assigned); treat as 'b' for storage
const color: 'b' | 'w' = colorRaw === 'w' ? 'w' : 'b';
```

Replace with:

```ts
// '-' is the TRF marker for byes (no color assigned); preserve as-is
const color: 'b' | 'w' | '-' =
  colorRaw === 'w' ? 'w' : colorRaw === 'b' ? 'b' : '-';
```

### Step 5: Run the tests

```bash
pnpm run test src/__tests__/index.spec.ts
```

Expected: all tests pass.

### Step 6: Run the full suite

```bash
pnpm run test
```

Expected: all tests pass. The stringify roundtrip tests already assert `color`
equality — they will now verify `-` roundtrips faithfully.

### Step 7: Run lint

```bash
pnpm run lint:ci
```

Expected: clean.

### Step 8: Commit

```bash
git add src/types.ts src/parse.ts src/__tests__/index.spec.ts
git commit -m "fix: preserve '-' color byte in RoundResult instead of normalising to 'b'"
```

---

## Task 2: Bump version to 3.0.0 and update docs

**Files:**

- Modify: `package.json`
- Modify: `CHANGELOG.md`
- Modify: `README.md`
- Modify: `AGENTS.md`

### Step 1: Bump version in `package.json`

```json
"version": "3.0.0"
```

### Step 2: Update `CHANGELOG.md`

Add at the top (after `# Changelog`):

```markdown
## 3.0.0 — 2026-03-18

### Breaking Changes

- `RoundResult.color` is now `'b' | 'w' | '-'`. The `-` value represents entries
  with no color assigned (byes, unplayed games). Previously these were silently
  normalised to `'b'`, losing information.

### Fixed

- Parse and stringify now roundtrip `-` color entries faithfully.
```

### Step 3: Update `README.md`

In the Types section, update the `RoundResult` interface:

```ts
interface RoundResult {
  color: 'b' | 'w' | '-'; // '-' = no color assigned (bye/unplayed)
  opponentId: number | null; // null for byes
  result: ResultCode;
  round: number;
}
```

### Step 4: Update `AGENTS.md`

Find the stale description of the package:

```
Pure parser library, no runtime dependencies. Default export:
`parse(input, options?) → Tournament | null`. Never throws; returns `null` on
failure and calls `options.onError`. Recoverable issues emit
`options.onWarning`.
```

Replace with:

```
Parser and serializer library, no runtime dependencies. Named exports:
`parse(input, options?) → Tournament | null` and
`stringify(tournament, options?) → string`. Never throws; parse failures
return `null` and call `options.onError`. Recoverable issues emit
`options.onWarning`.
```

Also update the architecture note:

Find:

```
- `src/index.ts` contains both the implementation and public re-exports.
```

Replace with:

```
- `src/index.ts` is a re-export barrel. Logic lives in `src/parse.ts` and `src/stringify.ts`.
- `src/columns.ts` contains shared column offset constants.
```

### Step 5: Final full check

```bash
pnpm run lint:ci && pnpm run test && pnpm run build
```

Expected: all pass.

### Step 6: Commit

```bash
git add package.json CHANGELOG.md README.md AGENTS.md
git commit -m "chore: bump to 3.0.0, update docs for color '-' breaking change"
```
