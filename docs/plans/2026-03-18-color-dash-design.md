# Design: Preserve `-` color in `RoundResult`

**Date:** 2026-03-18  
**Status:** Approved

---

## Problem

The TRF format uses `-` as the color byte in round entries where no color was
assigned — byes, forfeits without color, and unplayed games. Example from the
JaVaFo fixture:

```
0000 - H    (half-point bye, no opponent, no color)
0000 - Z    (zero-point bye, no opponent, no color)
```

The parser currently normalises `-` → `'b'`:

```ts
const color: 'b' | 'w' = colorRaw === 'w' ? 'w' : 'b';
```

This loses information. A consumer cannot distinguish "played as black" from "no
color assigned". `stringify` then writes `b` back, making the roundtrip lossy.

---

## Solution

Expand `RoundResult.color` to `'b' | 'w' | '-'` and preserve `-` through parse
and stringify.

---

## Breaking Change

`RoundResult.color: 'b' | 'w'` → `'b' | 'w' | '-'`.

Any consumer with an exhaustive switch/check on `color` will get a TypeScript
error. Version bump: **3.0.0**.

---

## Type change — `src/types.ts`

```ts
interface RoundResult {
  color: 'b' | 'w' | '-'; // '-' = no color assigned (bye/unplayed)
  opponentId: number | null;
  result: ResultCode;
  round: number;
}
```

---

## Parser change — `src/parse.ts`

Replace the normalisation:

```ts
// before
const color: 'b' | 'w' = colorRaw === 'w' ? 'w' : 'b';

// after
const color: 'b' | 'w' | '-' =
  colorRaw === 'w' ? 'w' : colorRaw === 'b' ? 'b' : '-';
```

The validation guard already accepts `-`:

```ts
if (colorRaw !== 'w' && colorRaw !== 'b' && colorRaw !== '-') { ... }
```

No change needed there.

---

## Stringify — `src/stringify.ts`

No code change required. The round entry is built as:

```ts
`${opponentStr} ${result.color} ${result.result}  `;
```

`'-'` is already a valid 1-char value and writes through correctly.

---

## Testing

### Fixtures affected

Both `dutch_2025_C5` and `javafo_sample2` have Z-bye/H-bye entries with `-` as
the color byte.

### New unit tests (`src/__tests__/index.spec.ts`)

- Parse a `001` line with `0000 - H` in a round slot → `color === '-'`
- Parse a `001` line with `0000 - Z` in a round slot → `color === '-'`

### Updated fixture tests

- `javafo_sample2`: assert player 14's round 3 bye has `color: '-'` (previously
  stored as `'b'`)
- `dutch_2025_C5`: the Z-bye for player 4 now has `color: '-'`; the existing
  test only checks `opponentId` so no update needed there, but add a `color`
  assertion

### Roundtrip tests (`src/__tests__/stringify.spec.ts`)

The existing roundtrip tests already assert `color` equality per result — once
the parser preserves `-` and stringify writes it back, all roundtrip tests
should pass without changes. Verify this.

---

## Version

**3.0.0** — breaking type change to `RoundResult.color`.

CHANGELOG entry:

```markdown
## 3.0.0 — 2026-03-18

### Breaking Changes

- `RoundResult.color` is now `'b' | 'w' | '-'`. The `-` value represents entries
  with no color assigned (byes, forfeits). Previously these were silently
  normalised to `'b'`.

### Fixed

- Parse and stringify now roundtrip `-` color entries faithfully.
```
