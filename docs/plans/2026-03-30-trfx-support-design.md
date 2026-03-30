# TRFx Support Design

**Date:** 2026-03-30 **Approach:** Extend existing types, parse XX tags as
aliases where possible

## Context

TRFx is the de facto input format for JaVaFo, the FIDE reference pairing engine.
Most FIDE-endorsed tournament software (Swiss-Manager, Vega, chess-results.com,
Tornelo, ChessManager) uses JaVaFo under the hood, making TRFx files common in
the wild.

The library currently recognises `XXR` (fully functional) and `XXC` (silenced,
value dropped). The remaining tags — `XXZ`, `XXS`, `XXA`, `XXP` — trigger
unknown-tag warnings and their data is lost.

TRF26 absorbed most TRFx concepts into numbered tags (142, 152, 162, 250, 260),
but the formats differ. Supporting both ensures the library can read files from
any era.

## Section 1 — New Types

### `PlayerAcceleration`

Per-player round-by-round fictitious points (XXA format).

```typescript
interface PlayerAcceleration {
  pairingNumber: number;
  points: number[]; // points[i] = fictitious points for round i+1
}
```

Coexists with the existing `AcceleratedRound[]` (tag 250 format). Parser fills
the appropriate field based on the source tag.

## Section 2 — Extended `ScoringSystem`

Add 11 optional colour-specific and bye-specific fields from XXS. Existing
fields unchanged — fully backward compatible.

| New field      | XXS code | Default | Description     |
| -------------- | -------- | ------- | --------------- |
| `blackDraw`    | `BD`     | 0.5     | Draw with Black |
| `blackLoss`    | `BL`     | 0.0     | Loss with Black |
| `blackWin`     | `BW`     | 1.0     | Win with Black  |
| `forfeitLoss`  | `FL`     | 0.0     | Forfeit loss    |
| `forfeitWin`   | `FW`     | 1.0     | Forfeit win     |
| `fullPointBye` | `FPB`    | 1.0     | Full-point bye  |
| `halfPointBye` | `HPB`    | 0.5     | Half-point bye  |
| `whiteDraw`    | `WD`     | 0.5     | Draw with White |
| `whiteLoss`    | `WL`     | 0.0     | Loss with White |
| `whiteWin`     | `WW`     | 1.0     | Win with White  |
| `zeroPointBye` | `ZPB`    | 0.0     | Zero-point bye  |

Shortcut handling: `W` sets `whiteWin`, `blackWin`, `forfeitWin`,
`fullPointBye`. `D` sets `whiteDraw`, `blackDraw`, `halfPointBye`. Last value
wins per spec.

The existing symmetric fields (`win`, `draw`, `loss`, `absence`,
`pairingAllocatedBye`, `unknown`) remain for tag 162.

## Section 3 — New Tournament Fields

| Field                 | Type                   | Source   | Position (alphabetical) |
| --------------------- | ---------------------- | -------- | ----------------------- |
| `absentPlayers`       | `number[]`             | XXZ      | after `abnormalPoints`  |
| `playerAccelerations` | `PlayerAcceleration[]` | XXA      | after `players`         |
| `useRankingId`        | `boolean`              | XXC rank | after `tournamentType`  |

`XXC white1`/`black1` reuses the existing `initialColour` field. `XXP` reuses
the existing `prohibitedPairings` field.

## Section 4 — Parse Behaviour

All five tags added to `KNOWN_HEADER_TAGS`.

### `XXC`

Split line after prefix by whitespace. For each token:

- `rank` → `tournament.useRankingId = true`
- `white1` → `tournament.initialColour = 'W'`
- `black1` → `tournament.initialColour = 'B'`

Cumulative: multiple XXC lines or combined tokens on one line.

### `XXZ`

Split by whitespace after prefix. Parse each token as a player ID (number).
Multiple XXZ lines concatenate into `absentPlayers`.

### `XXP`

Split by whitespace after prefix. Parse as list of player IDs. Store as a
`ProhibitedPairing` with `firstRound: 0` and `lastRound: 0` (meaning all rounds
— distinguishable from tag 260 which uses real round numbers).

### `XXA`

Player ID at columns 4–8 (trimmed). Points start at column 9, stride 5 (`pp.p`
format: 4 chars + 1 space). Parse as `PlayerAcceleration`.

### `XXS`

Parse `CODE=VALUE` pairs (space-separated). Map each code to the corresponding
`ScoringSystem` field. Shortcut expansion:

- `W=n` → `whiteWin=n`, `blackWin=n`, `forfeitWin=n`, `fullPointBye=n`
- `D=n` → `whiteDraw=n`, `blackDraw=n`, `halfPointBye=n`

Last value wins (left-to-right, top-to-bottom across lines). Multiple XXS lines
are cumulative.

## Section 5 — Stringify Behaviour

When `version === 'TRF26'`, prefer numbered tags (142, 152, 162, 250, 260).
XXS-only fields (colour-specific) that have no tag 162 equivalent are emitted as
XXS lines even in TRF26 mode.

When `version === 'TRF16'`, emit XX tags for:

- `absentPlayers` → `XXZ`
- `playerAccelerations` → `XXA`
- `useRankingId` / `initialColour` → `XXC`
- `prohibitedPairings` with `firstRound: 0, lastRound: 0` → `XXP`
- Colour-specific scoring fields → `XXS`

## Section 6 — Error Handling

No throws. Malformed XXS values (non-numeric, unknown codes) emit `onWarning`.
Malformed player IDs in XXZ/XXP/XXA emit `onWarning` and skip the entry.
