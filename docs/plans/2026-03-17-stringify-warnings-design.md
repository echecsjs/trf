# Design: `stringify()` truncation warnings

**Date:** 2026-03-17  
**Status:** Approved

---

## Overview

Add an optional `options` parameter to `stringify()` that accepts an `onWarning`
callback. The callback fires when a player string field exceeds its fixed TRF
column width and will be truncated. Output is always produced — warnings are
non-fatal.

---

## API

```ts
function stringify(tournament: Tournament, options?: StringifyOptions): string;
```

**New type in `src/types.ts`:**

```ts
interface StringifyOptions {
  onWarning?: (warning: ParseWarning) => void;
}
```

Reuses `ParseWarning` (`{ message, line, column, offset }`) for consistency with
`parse()`. `StringifyOptions` is exported from the package root.

---

## Warning conditions

Only player string fields with fixed column widths can overflow:

| Field        | Max width | Column (0-indexed) | 1-based column |
| ------------ | --------- | ------------------ | -------------- |
| `name`       | 33 chars  | 14                 | 15             |
| `federation` | 3 chars   | 53                 | 54             |
| `fideId`     | 12 chars  | 57                 | 58             |
| `birthDate`  | 10 chars  | 70                 | 71             |

Tournament-level header fields are free-form text — no fixed width, no
truncation, no warnings.

Numeric fields (`rating`, `pairingNumber`, `points`, `rank`) are not warned on —
overflow is a caller error and not a realistic scenario for valid tournament
data.

---

## Warning shape

- **`message`**:
  `Player ${index + 1}: ${field} exceeds ${max} characters and will be truncated`
- **`line`**: 1-based player index (`tournament.players.indexOf(player) + 1`)
- **`column`**: 1-based column offset of the field
- **`offset`**: `0` (no byte offset applicable to a `Tournament` object)

---

## Implementation

- `stringifyPlayerLine` gains an `onWarning` parameter and a `playerIndex`
  (0-based) parameter.
- Before writing each truncatable field, check `value.length > maxWidth` and
  call `onWarning` with the appropriate warning if so. Then truncate and write
  as normal.
- `stringify` threads `options?.onWarning` and the player's array index down to
  `stringifyPlayerLine`.
- No changes to `columns.ts`, `parse.ts`, or `index.ts` beyond re-exporting
  `StringifyOptions`.

---

## Testing

New tests in `src/__tests__/stringify.spec.ts`:

- `onWarning` called when `name` > 33 chars; not called at exactly 33
- `onWarning` called when `federation` > 3 chars
- `onWarning` called when `fideId` > 12 chars
- `onWarning` called when `birthDate` > 10 chars
- Warning `message` contains field name and character limit
- Warning `line` equals 1-based player index
- Warning `column` equals correct 1-based column offset
- Output is still produced (truncated) when warning fires
- No warning when `options` is omitted (existing tests unaffected)
