# TRF

[![npm](https://img.shields.io/npm/v/@echecs/trf)](https://www.npmjs.com/package/@echecs/trf)
[![Coverage](https://codecov.io/gh/echecsjs/trf/branch/main/graph/badge.svg)](https://codecov.io/gh/echecsjs/trf)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**TRF** is a TypeScript parser and serializer for the
[FIDE Tournament Report File](https://handbook.fide.com/files/handbook/TRF26.pdf)
format — the standard interchange format used by all FIDE-endorsed pairing
software (JaVaFo, bbpPairings, Swiss Manager, Vega).

Parses TRF strings into a fully-typed `Tournament` object and serializes them
back. Zero runtime dependencies.

## Installation

```bash
npm install @echecs/trf
```

## Quick Start

```typescript
import { parse, stringify } from '@echecs/trf';

const tournament = parse(trfString);

console.log(tournament.name); // "My Tournament"
console.log(tournament.rounds); // 9
console.log(tournament.players[0].name); // "Player0001"
console.log(tournament.players[0].rating); // 2720
console.log(tournament.players[0].results); // [{ round: 1, color: 'w', opponentId: 4, result: '1' }, ...]

const trf = stringify(tournament); // back to TRF string
```

## Usage

### `parse()`

```typescript
import { parse } from '@echecs/trf';

function parse(input: string, options?: ParseOptions): Tournament | null;
```

Takes a TRF string and returns a `Tournament` object, or `null` if the input
cannot be parsed.

- Strips BOM and surrounding whitespace automatically.
- Never throws — parse failures call `options.onError` and return `null`.
- Recoverable issues (unknown tags, malformed fields) call `options.onWarning`
  and continue parsing.

```typescript
import { parse } from '@echecs/trf';

const tournament = parse(trfString, {
  onError: (err) => console.error(`Parse failed: ${err.message}`),
  onWarning: (warn) => console.warn(`Warning: ${warn.message}`),
});
```

### Result codes

Round results on each player use the following codes:

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `1`  | Win                                     |
| `0`  | Loss                                    |
| `=`  | Draw                                    |
| `+`  | Forfeit win                             |
| `-`  | Forfeit loss                            |
| `D`  | Draw (unrated game, less than one move) |
| `F`  | Full-point bye                          |
| `H`  | Half-point bye                          |
| `L`  | Loss (unrated game, less than one move) |
| `U`  | Unplayed                                |
| `W`  | Win (unrated game, less than one move)  |
| `Z`  | Zero-point bye                          |

### `stringify()`

```typescript
import { stringify } from '@echecs/trf';

function stringify(tournament: Tournament, options?: StringifyOptions): string;
```

Takes a `Tournament` object and returns a TRF string.

- Never throws.
- Omits optional header fields when absent.
- `parse(stringify(t))` roundtrips cleanly for any valid `Tournament`.
- Warns (via `options.onWarning`) when a player string field exceeds its column
  width and will be truncated.

```typescript
import { parse, stringify } from '@echecs/trf';

const t1 = parse(trfString)!;
// ...modify t1...
const updated = stringify(t1, {
  onWarning: (w) => console.warn(w.message),
});
```

### Using with `@echecs/swiss`

`@echecs/trf` has no dependency on `@echecs/swiss` by design. To use a parsed
tournament as input to the Swiss pairing functions, adapt the types in your own
code:

```typescript
import { parse } from '@echecs/trf';
import { pair } from '@echecs/swiss';

import type { Tournament } from '@echecs/trf';
import type { Game, Player } from '@echecs/swiss';

function toPlayers(tournament: Tournament): Player[] {
  return tournament.players.map((p) => ({
    id: String(p.pairingNumber),
    rating: p.rating,
  }));
}

function toGames(tournament: Tournament): Game[][] {
  const gamesByRound = new Map<number, Game[]>();
  for (const player of tournament.players) {
    for (const result of player.results) {
      if (result.color !== 'w' || result.opponentId === null) continue;
      let score: 0 | 0.5 | 1;
      if (result.result === '1' || result.result === '+') score = 1;
      else if (result.result === '0' || result.result === '-') score = 0;
      else if (result.result === '=') score = 0.5;
      else continue;
      const games = gamesByRound.get(result.round) ?? [];
      games.push({
        black: String(result.opponentId),
        result: score,
        white: String(player.pairingNumber),
      });
      gamesByRound.set(result.round, games);
    }
  }
  const roundCount = Math.max(0, ...gamesByRound.keys());
  return Array.from(
    { length: roundCount },
    (_, i) => gamesByRound.get(i + 1) ?? [],
  );
}

const tournament = parse(trfString)!;
const pairings = pair(toPlayers(tournament), toGames(tournament));
```

## Types

### `Tournament`

```typescript
interface Tournament {
  abnormalPoints?: AbnormalPoints[]; // Tag 299 — abnormal result overrides per round
  absentPlayers?: number[]; // XXZ — pairing numbers absent for current round
  acceleratedRounds?: AcceleratedRound[]; // Tag 250 — per-player fictitious points per round range
  byes?: Bye[]; // Tag 240 — bye assignments per round
  chiefArbiter?: string; // Tag 102
  city?: string;
  colourSequence?: string; // Tag 352 — e.g. 'WBWBWB'
  comments?: string[]; // TRF26 '###' comment lines
  deputyArbiters?: string[]; // Tag 112 — one entry per deputy arbiter line
  encodedTimeControl?: string; // Tag 222 — e.g. '5400+30'
  encodedTournamentType?: string; // Tag 192 — e.g. 'FIDE_DUTCH_2025'
  endDate?: string;
  federation?: string;
  forfeitedMatches?: ForfeitedMatch[]; // Tag 330 — forfeited team matches per round
  initialColour?: 'B' | 'W'; // Tag 152 / XXC white1/black1
  name?: string;
  numberOfPlayers?: number; // Tag 062
  numberOfRatedPlayers?: number; // Tag 072
  numberOfTeams?: number; // Tag 082
  outOfOrderLineups?: OutOfOrderLineup[]; // Tag 300 — out-of-order team lineups per round
  pairingController?: string; // Tag 092
  playerAccelerations?: PlayerAcceleration[]; // XXA — per-player acceleration points
  players: Player[];
  prohibitedPairings?: ProhibitedPairing[]; // Tag 260 / XXP — forbidden pairings
  roundDates?: string[]; // Tag 132 — one ISO date per round
  rounds: number; // XXR — total planned round count
  scoringSystem?: ScoringSystem; // Tag 162 / XXS
  standingsTiebreaks?: string[]; // Tag 212 — codes for defining standings
  startDate?: string;
  startingRankMethod?: string; // Tag 172 — e.g. 'FRA FIDON'
  teamPairingAllocatedByes?: TeamPairingAllocatedBye; // Tag 320
  teamRoundResults?: TeamRoundResult[]; // Tags 801/802 — team round-by-round results
  teams?: Team[]; // Tag 310
  teamScoringSystem?: string; // Tag 362 — e.g. 'TW 2.0    TD 1.0    TL 0.0'
  tiebreaks?: string[]; // Tag 202 — codes for breaking ties
  timeControl?: string; // Tag 122
  tournamentType?: string; // Tag 092 (TRF26) — free-form tournament type
  useRankingId?: boolean; // XXC rank
  version: Version; // 'TRF16' | 'TRF26'
}
```

### `Player`

```typescript
interface Player {
  birthDate?: string;
  federation?: string;
  fideId?: string;
  name: string;
  nationalRatings?: NationalRating[]; // NRS records for this player
  pairingNumber: number;
  points: number;
  rank: number;
  rating?: number;
  results: RoundResult[];
  sex?: Sex; // 'm' | 'w'
  title?: Title; // 'GM' | 'IM' | 'FM' | ...
}
```

### `RoundResult`

```typescript
interface RoundResult {
  color: 'b' | 'w' | '-'; // '-' = no color assigned (bye/unplayed)
  opponentId: number | null; // null for byes
  result: ResultCode;
  round: number;
}
```

### `PlayerAcceleration`

Per-player acceleration record (XXA). Stores fictitious extra points per round.

```typescript
interface PlayerAcceleration {
  pairingNumber: number;
  points: number[]; // one value per round, indexed from 0
}
```

### `ScoringSystem`

Custom scoring weights for result types (Tag 162 / XXS).

```typescript
interface ScoringSystem {
  absence?: number;
  blackDraw?: number;
  blackLoss?: number;
  blackWin?: number;
  draw?: number;
  forfeitLoss?: number;
  forfeitWin?: number;
  fullPointBye?: number;
  halfPointBye?: number;
  loss?: number;
  pairingAllocatedBye?: number;
  unknown?: number;
  whiteDraw?: number;
  whiteLoss?: number;
  whiteWin?: number;
  win?: number;
  zeroPointBye?: number;
}
```

### `TeamRoundResult`

Team round-by-round result record (tags `801` and `802`). One entry per line in
the TRF file. Tag `802` uses structured per-round fields; tag `801` stores raw
per-round strings.

```typescript
interface TeamRoundResult {
  gamePoints: number;
  matchPoints: number;
  nickname?: string;
  results: TeamRoundResult801[] | TeamRoundResult802[];
  tag: '801' | '802';
  teamId: number;
}

interface TeamRoundResult801 {
  opponentId: number | null;
  raw: string; // e.g. 'b =0=1 1234'
  round: number;
  type?: 'FPB' | 'HPB' | 'PAB' | 'ZPB';
}

interface TeamRoundResult802 {
  color?: 'b' | 'w';
  forfeit?: boolean;
  gamePoints: number;
  opponentId: number | null;
  round: number;
  type?: 'FPB' | 'HPB' | 'PAB' | 'ZPB';
}
```

### `ParseOptions`

```typescript
interface ParseOptions {
  onError?: (error: ParseError) => void;
  onWarning?: (warning: ParseWarning) => void;
}
```

### `ParseError`

Reported via `ParseOptions.onError` when parsing fails unrecoverably. When an
error is reported, `parse()` returns `null`.

```typescript
interface ParseError {
  column: number; // 1-based column in the source
  line: number; // 1-based line in the source
  message: string;
  offset: number; // byte offset in the source
}
```

### `ParseWarning`

Reported via `ParseOptions.onWarning` (or `StringifyOptions.onWarning`) for
recoverable issues. Parsing continues after a warning.

```typescript
interface ParseWarning {
  column: number; // 1-based column in the source
  line: number; // 1-based line in the source (player index for stringify)
  message: string;
  offset: number; // byte offset in the source (0 for stringify)
}
```

### `StringifyOptions`

```typescript
interface StringifyOptions {
  onWarning?: (warning: ParseWarning) => void;
}
```

### `ResultCode`

```typescript
type ResultCode =
  | '+' // forfeit win
  | '-' // forfeit loss
  | '0' // loss
  | '1' // win
  | '=' // draw
  | 'D' // draw (unrated game, less than one move)
  | 'F' // full-point bye
  | 'H' // half-point bye
  | 'L' // loss (unrated game, less than one move)
  | 'U' // unplayed
  | 'W' // win (unrated game, less than one move)
  | 'Z'; // zero-point bye
```

### `Sex`

```typescript
type Sex = 'm' | 'w';
```

### `Title`

FIDE title codes.

```typescript
type Title = 'CM' | 'FM' | 'GM' | 'IM' | 'WCM' | 'WFM' | 'WGM' | 'WIM';
```

### `Version`

```typescript
type Version = 'TRF16' | 'TRF26';
```

## Supported Formats

| Format | Status | Description                                                               |
| ------ | ------ | ------------------------------------------------------------------------- |
| TRF16  | Full   | FIDE TRF standard (2016)                                                  |
| TRF26  | Full   | FIDE TRF standard (2026), all tags including 162, 192, 172, 222, 352, 362 |
| TRFx   | Full   | JaVaFo extensions (XXC, XXZ, XXP, XXA, XXS)                               |

## TRF Format Reference

The Tournament Report File (TRF) format is defined in the
[FIDE Handbook](https://handbook.fide.com/files/handbook/TRF26.pdf). TRF16 is
the 2016 standard; TRF26 was approved by FIDE Council on 12/05/2025 and applied
from 01/09/2025. TRFx is the de facto extension format used by JaVaFo, the FIDE
reference pairing engine.

## License

MIT
