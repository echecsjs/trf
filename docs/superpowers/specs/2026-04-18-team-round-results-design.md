# Team Round-by-Round Results (801/802)

**Issue:** [#2](https://github.com/echecsjs/trf/issues/2) **Date:** 2026-04-18

## Summary

Parse and emit TRF26 tags 801 and 802 — informative team round-by-round results.
802 gets structured fields from its documented fixed-column layout. 801 keeps
raw per-round strings (board-level detail is undocumented).

## Types

```typescript
interface TeamRoundResult802 {
  color?: 'b' | 'w';
  forfeit?: boolean;
  gamePoints: number;
  opponentId: number | null; // null for byes
  round: number;
  type?: 'FPB' | 'HPB' | 'PAB' | 'ZPB'; // set when it's a bye
}

interface TeamRoundResult801 {
  opponentId: number | null;
  raw: string; // e.g. "=0=1 1234" or "FFFF" for byes
  round: number;
  type?: 'FPB' | 'HPB' | 'PAB' | 'ZPB';
}

interface TeamRoundResult {
  gamePoints: number;
  matchPoints: number;
  nickname?: string;
  results: TeamRoundResult801[] | TeamRoundResult802[];
  tag: '801' | '802';
  teamId: number;
}
```

On `Tournament`:

```typescript
interface Tournament {
  // ... existing fields ...
  teamRoundResults?: TeamRoundResult[];
  // ...
}
```

One entry per 801/802 line. A team with both 801 and 802 records gets two
entries in the array.

## Parsing

### 802 — fixed columns (from SPEC.md)

| Position | Description                        |
| -------- | ---------------------------------- |
| 1-3      | `802`                              |
| 5-7      | Team Pairing Number                |
| 9-13     | Team Nickname                      |
| 15-20    | Total match points                 |
| 22-27    | Total game points                  |
| 29+      | Repeating 13-char blocks per round |

Each round block (13 chars):

| Offset (within block) | Description                               |
| --------------------- | ----------------------------------------- |
| 0-2                   | Opponent id or bye type (PAB/FPB/HPB/ZPB) |
| 4                     | Color (w/b or empty for bye)              |
| 6-9                   | Game points for that round                |
| 10                    | Forfeit indicator (f/F or empty)          |

### 801 — same header, raw round data

Same header columns as 802 (team id, nickname, match points, game points).
Per-round blocks are split by opponent boundaries but stored as raw strings — no
further parsing of individual board results.

### Both tags

- TRF26-only (already in `TRF26_ONLY_TAGS`)
- Handled in the parser's tag switch (currently fall through to default)

## Stringifying

- Only emitted when `version === 'TRF26'` and `teamRoundResults` is present
- 802: rebuilt from structured fields using fixed-column layout
- 801: rebuilt from raw strings
- Emitted after team records (310/320/330/300)

## Error handling

- Malformed 801/802 lines: skip the line, emit `onWarning`
- No `onError` — these are informative records, not critical

## Tests

- Parse 802 from `grandmommyscup` fixture — verify structured fields for a
  couple of teams including byes and forfeits
- Parse 801 from same fixture — verify raw strings preserved
- Round-trip: parse then stringify, compare 802 output
- Unit tests for edge cases: all-bye team (ZPB), forfeit indicator, missing
  rounds

## Files to change

- `src/types.ts` — add `TeamRoundResult`, `TeamRoundResult801`,
  `TeamRoundResult802`, add `teamRoundResults` to `Tournament`, update exports
- `src/parse.ts` — add cases for 801 and 802 in the tag switch
- `src/stringify.ts` — emit 801/802 records
- `src/__tests__/index.spec.ts` — tests
