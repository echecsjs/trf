# stringify() Truncation Warnings Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Add an optional `StringifyOptions` parameter to `stringify()` with an
`onWarning` callback that fires when a player string field exceeds its fixed TRF
column width.

**Architecture:** Add `StringifyOptions` to `src/types.ts`, re-export it from
`src/index.ts`, update `stringifyPlayerLine` in `src/stringify.ts` to accept
`onWarning` + `playerIndex` and emit warnings before truncating, thread the
callback through `stringify()`.

**Tech Stack:** TypeScript, Vitest. No new dependencies.

---

## Task 1: Add `StringifyOptions` type and re-export it

**Files:**

- Modify: `src/types.ts`
- Modify: `src/index.ts`

**Step 1: Write a failing test**

Add to `src/__tests__/stringify.spec.ts` (at the top, after the existing
imports):

```ts
import type { StringifyOptions } from '../types.js';
```

Then add a new describe block at the bottom:

```ts
describe('stringify — onWarning', () => {
  it('accepts a StringifyOptions object without throwing', () => {
    const options: StringifyOptions = { onWarning: vi.fn() };
    expect(() => stringify(minimal(), options)).not.toThrow();
  });
});
```

**Step 2: Run to confirm it fails**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: FAIL — `StringifyOptions` type not found.

**Step 3: Add `StringifyOptions` to `src/types.ts`**

Add after the `ParseWarning` interface (keep sort-keys order — alphabetical
within the export list):

```ts
interface StringifyOptions {
  onWarning?: (warning: ParseWarning) => void;
}
```

Also add `StringifyOptions` to the `export type { ... }` block at the bottom, in
alphabetical position (between `Sex` and `Title`):

```ts
export type {
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  ResultCode,
  RoundResult,
  Sex,
  StringifyOptions,
  Title,
  Tournament,
  Version,
};
```

**Step 4: Re-export from `src/index.ts`**

Add `StringifyOptions` to the type re-export block in `src/index.ts`
(alphabetical position):

```ts
export type {
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  ResultCode,
  RoundResult,
  Sex,
  StringifyOptions,
  Title,
  Tournament,
  Version,
} from './types.js';
```

**Step 5: Run the test**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: the new test passes. All existing tests still pass.

**Step 6: Run lint**

```bash
pnpm run lint:ci
```

Expected: clean.

**Step 7: Commit**

```bash
git add src/types.ts src/index.ts src/__tests__/stringify.spec.ts
git commit -m "feat: add StringifyOptions type with onWarning callback"
```

---

## Task 2: Wire `options` into `stringify()` and thread to `stringifyPlayerLine`

**Files:**

- Modify: `src/stringify.ts`

**Step 1: Write failing tests**

Add to the `describe('stringify — onWarning', ...)` block in
`src/__tests__/stringify.spec.ts`:

```ts
it('calls onWarning when name exceeds 33 characters', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ name: 'A'.repeat(34) });
  stringify(minimal({ players: [player] }), { onWarning });
  expect(onWarning).toHaveBeenCalledOnce();
});

it('does not call onWarning when name is exactly 33 characters', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ name: 'A'.repeat(33) });
  stringify(minimal({ players: [player] }), { onWarning });
  expect(onWarning).not.toHaveBeenCalled();
});

it('calls onWarning when federation exceeds 3 characters', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ federation: 'FRAN' });
  stringify(minimal({ players: [player] }), { onWarning });
  expect(onWarning).toHaveBeenCalledOnce();
});

it('calls onWarning when fideId exceeds 12 characters', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ fideId: '1234567890123' }); // 13 chars
  stringify(minimal({ players: [player] }), { onWarning });
  expect(onWarning).toHaveBeenCalledOnce();
});

it('calls onWarning when birthDate exceeds 10 characters', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ birthDate: '1963-04-13X' }); // 11 chars
  stringify(minimal({ players: [player] }), { onWarning });
  expect(onWarning).toHaveBeenCalledOnce();
});

it('still produces output when onWarning fires', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ name: 'A'.repeat(34) });
  const result = stringify(minimal({ players: [player] }), { onWarning });
  const line = result.split('\n').find((l) => l.startsWith('001'))!;
  expect(line.slice(14, 47)).toBe('A'.repeat(33));
});

it('warning message includes field name and limit', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ name: 'A'.repeat(34) });
  stringify(minimal({ players: [player] }), { onWarning });
  const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
  expect(warn.message).toMatch(/name/i);
  expect(warn.message).toMatch(/33/);
});

it('warning line equals 1-based player index', () => {
  const onWarning = vi.fn();
  const players = [
    minimalPlayer({ pairingNumber: 1 }),
    minimalPlayer({ pairingNumber: 2, name: 'A'.repeat(34) }),
  ];
  stringify(minimal({ players }), { onWarning });
  const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
  expect(warn.line).toBe(2);
});

it('warning column equals 1-based column offset of the field', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ name: 'A'.repeat(34) });
  stringify(minimal({ players: [player] }), { onWarning });
  const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
  expect(warn.column).toBe(15); // COL_NAME + 1
});

it('warning offset is 0', () => {
  const onWarning = vi.fn();
  const player = minimalPlayer({ name: 'A'.repeat(34) });
  stringify(minimal({ players: [player] }), { onWarning });
  const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
  expect(warn.offset).toBe(0);
});

it('does not warn when options is omitted', () => {
  // Should not throw even with an overlong name and no options
  const player = minimalPlayer({ name: 'A'.repeat(34) });
  expect(() => stringify(minimal({ players: [player] }))).not.toThrow();
});
```

**Step 2: Run to confirm they fail**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: new tests FAIL — `stringify` doesn't accept a second argument yet.

**Step 3: Update `stringify()` signature and thread `onWarning`**

In `src/stringify.ts`:

1. Add `StringifyOptions` to the type import:

```ts
import type { Player, StringifyOptions, Tournament } from './types.js';
```

2. Update `stringifyPlayerLine` signature to accept `onWarning` and
   `playerIndex`:

```ts
function stringifyPlayerLine(
  player: Player,
  playerIndex: number,
  onWarning?: StringifyOptions['onWarning'],
): string {
```

3. Add a helper at the top of `stringifyPlayerLine` body:

```ts
function warnIfTruncated(
  value: string,
  field: string,
  max: number,
  col: number,
): void {
  if (value.length > max) {
    onWarning?.({
      column: col + 1,
      line: playerIndex + 1,
      message: `Player ${playerIndex + 1}: ${field} exceeds ${max} characters and will be truncated`,
      offset: 0,
    });
  }
}
```

4. Call `warnIfTruncated` before each truncatable field write:

```ts
// Name — left-aligned in 33 chars at col 14
warnIfTruncated(player.name, 'name', 33, COL_NAME);
writeAt(buf, COL_NAME, pad(player.name.slice(0, 33), 33, 'left'));

// Federation — left-aligned in 3 chars at col 53
if (player.federation !== undefined) {
  warnIfTruncated(player.federation, 'federation', 3, COL_FEDERATION);
  writeAt(buf, COL_FEDERATION, pad(player.federation.slice(0, 3), 3, 'left'));
}

// FIDE ID — left-aligned in 12 chars at col 57
if (player.fideId !== undefined) {
  warnIfTruncated(player.fideId, 'fideId', 12, COL_FIDE_ID);
  writeAt(buf, COL_FIDE_ID, pad(player.fideId.slice(0, 12), 12, 'left'));
}

// Birth date — left-aligned in 10 chars at col 70
if (player.birthDate !== undefined) {
  warnIfTruncated(player.birthDate, 'birthDate', 10, COL_BIRTH_DATE);
  writeAt(buf, COL_BIRTH_DATE, pad(player.birthDate.slice(0, 10), 10, 'left'));
}
```

5. Update `stringify()` signature and call site:

```ts
export default function stringify(
  tournament: Tournament,
  options?: StringifyOptions,
): string {
```

And update the player loop:

```ts
for (const [index, player] of tournament.players.entries()) {
  lines.push(stringifyPlayerLine(player, index, options?.onWarning));
}
```

**Step 4: Run the tests**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: all new onWarning tests pass. All existing tests still pass.

**Step 5: Run the full suite**

```bash
pnpm run test
```

Expected: all tests pass.

**Step 6: Run lint**

```bash
pnpm run lint:ci
```

Expected: clean. Watch for `sort-keys` on the warning object literal — fields
must be alphabetical (`column`, `line`, `message`, `offset`).

**Step 7: Commit**

```bash
git add src/stringify.ts src/__tests__/stringify.spec.ts
git commit -m "feat: stringify() onWarning for truncated string fields"
```

---

## Task 3: Update README and bump version

**Files:**

- Modify: `README.md`
- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Step 1: Update `README.md`**

Update the `stringify()` section. Change:

````markdown
- Never throws.
- Omits optional header fields when absent.
- `parse(stringify(t))` roundtrips cleanly for any valid `Tournament`.

```typescript
import { parse, stringify } from '@echecs/trf';

const t1 = parse(trfString)!;
// ...modify t1...
const updated = stringify(t1);
```
````

````

To:

```markdown
- Never throws.
- Omits optional header fields when absent.
- `parse(stringify(t))` roundtrips cleanly for any valid `Tournament`.
- Warns (via `options.onWarning`) when a player string field exceeds its
  column width and will be truncated.

```typescript
import { parse, stringify } from '@echecs/trf';

const t1 = parse(trfString)!;
// ...modify t1...
const updated = stringify(t1, {
  onWarning: (w) => console.warn(w.message),
});
````

````

Also add `StringifyOptions` to the Types section:

```typescript
interface StringifyOptions {
  onWarning?: (warning: ParseWarning) => void;
}
````

**Step 2: Bump version to 2.1.0 in `package.json`**

This is a non-breaking addition — minor bump.

```json
"version": "2.1.0"
```

**Step 3: Update `CHANGELOG.md`**

Add entry at the top:

```markdown
## 2.1.0 — 2026-03-17

### Added

- `stringify()` now accepts an optional `StringifyOptions` second argument.
- `StringifyOptions.onWarning` fires when a player string field (`name`,
  `federation`, `fideId`, `birthDate`) exceeds its TRF column width and will be
  truncated. Output is always produced.
- New exported type: `StringifyOptions`.
```

**Step 4: Final full check**

```bash
pnpm run lint:ci && pnpm run test && pnpm run build
```

Expected: all pass, zero warnings.

**Step 5: Commit**

```bash
git add README.md package.json CHANGELOG.md
git commit -m "chore: bump to 2.1.0, document stringify onWarning"
```
