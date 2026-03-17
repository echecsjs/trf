# Design: `stringify()` for `@echecs/trf`

**Date:** 2026-03-17  
**Status:** Approved

---

## Overview

Add a `stringify(tournament: Tournament): string` function — the inverse of
`parse()`. Takes a typed `Tournament` object and returns a valid TRF16 string.

---

## Motivation

The library is currently parse-only. Tooling that generates or transforms
tournament data (e.g. pairing software, converters) needs to write TRF files,
not just read them.

TRF does not need a generator tool (like Peggy) because the format is a rigid
fixed-width columnar layout. Each line is independent, fields sit at fixed byte
offsets, and there is no nesting or recursion. `stringify()` is as
straightforward as `parse()`.

---

## API

```ts
function stringify(tournament: Tournament): string;
```

- No options object — the input is already a typed value; the TypeScript
  compiler enforces the contract.
- Never throws.
- Returns a string of `\n`-separated TRF lines.
- Exported as a named export from the package root alongside `parse`:

```ts
import { parse, stringify } from '@echecs/trf';
```

---

## Module Structure

`src/index.ts` becomes a re-export barrel. Logic moves into dedicated files:

```
src/
  parse.ts       ← current index.ts logic, refactored
  stringify.ts   ← new implementation
  types.ts       ← unchanged
  index.ts       ← re-exports parse, stringify, and all types
```

`package.json` exports map is unchanged — single `"."` entry point.

---

## Output Format

### Line order

1. Header tags (only emitted when the field is present)
2. One `001` line per player, in `players` array order

### Header lines

| Tag   | Field          |
| ----- | -------------- |
| `012` | `name`         |
| `022` | `city`         |
| `032` | `federation`   |
| `042` | `startDate`    |
| `052` | `endDate`      |
| `092` | `chiefArbiter` |
| `112` | `timeControl`  |
| `XXR` | `rounds`       |

Format: `TAG value` (tag + space + value), e.g. `012 Open Championship`.

### Player lines (`001`) — fixed-width columns

| Col   | Field           | Width | Alignment |
| ----- | --------------- | ----- | --------- |
| 0–2   | `001`           | 3     | —         |
| 4–7   | `pairingNumber` | 4     | right     |
| 9     | `sex`           | 1     | —         |
| 10–13 | `title`         | 4     | left      |
| 14–46 | `name`          | 33    | left      |
| 48–51 | `rating`        | 4     | right     |
| 53–55 | `federation`    | 3     | left      |
| 57–67 | `fideId`        | 11    | left      |
| 70–79 | `birthDate`     | 10    | left      |
| 80–83 | `points`        | 4     | right     |
| 84–88 | `rank`          | 5     | right     |
| 91+   | round results   | 10 ea | fixed     |

Column positions mirror the `COL_*` constants in `parse.ts`.

### Round result slots

Each slot is 10 characters: `OOOO c r  ` where:

- `OOOO` = opponent pairing number, zero-padded to 4 digits (`0000` for
  byes/forfeits)
- `c` = color (`w` or `b`)
- `r` = result code (`1`, `0`, `=`, `+`, `-`, `F`, `H`, `U`, `Z`)
- 2 trailing spaces

Players with no results emit no round result columns (line ends after rank).

### `points` formatting

`points` is a float (e.g. `4.5`). Written with one decimal place, right-aligned
in 4 chars: `" 4.5"`. Integer values: `" 4.0"`.

---

## Error Handling

- Optional fields absent on `Tournament` or `Player` are written as spaces in
  their column slot. The parser treats blank columns as `undefined`, so
  roundtrip is safe.
- No truncation warnings. Values that overflow their column slot are the
  caller's responsibility.
- No line-ending option — always `\n`.
- No TRF26 support — deferred, same as the parser.

---

## Roundtrip Guarantee

`parse(stringify(t))` produces a tournament structurally equal to `t` for any
valid `Tournament`.

---

## Testing

- `src/__tests__/stringify.spec.ts` — mirrors the existing `index.spec.ts`
  pattern
- Roundtrip tests: parse each fixture, stringify, parse again — assert deep
  equality
- Field-level tests: verify each column offset is written correctly
- Edge cases: empty players array, missing optional header fields, player with
  no round results, `0000` opponent for byes
