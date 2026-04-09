# TRF

[![npm](https://img.shields.io/npm/v/@echecs/trf)](https://www.npmjs.com/package/@echecs/trf)
[![Coverage](https://codecov.io/gh/mormubis/trf/branch/main/graph/badge.svg)](https://codecov.io/gh/mormubis/trf)
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

| Code | Meaning        |
| ---- | -------------- |
| `1`  | Win            |
| `0`  | Loss           |
| `=`  | Draw           |
| `+`  | Forfeit win    |
| `-`  | Forfeit loss   |
| `F`  | Full-point bye |
| `H`  | Half-point bye |
| `U`  | Unplayed       |
| `Z`  | Zero-point bye |

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

```typescript
interface Tournament {
  absentPlayers?: number[]; // XXZ — players absent for current round
  chiefArbiter?: string;
  city?: string;
  colourSequence?: string; // Tag 352 — e.g. 'WBWBWB'
  encodedTimeControl?: string; // Tag 222 — e.g. '5400+30'
  encodedTournamentType?: string; // Tag 192 — e.g. 'FIDE_DUTCH_2025'
  endDate?: string;
  federation?: string;
  initialColour?: 'B' | 'W'; // Tag 152 / XXC white1/black1
  name?: string;
  playerAccelerations?: PlayerAcceleration[]; // XXA — per-player fictitious points
  players: Player[];
  rounds: number;
  scoringSystem?: ScoringSystem; // Tag 162 / XXS
  standingsTiebreaks?: string[]; // Tag 212 — codes for defining standings
  startDate?: string;
  startingRankMethod?: string; // Tag 172 — e.g. 'FRA FIDON'
  teams?: Team[];
  teamScoringSystem?: string; // Tag 362 — e.g. 'TW 2.0    TD 1.0    TL 0.0'
  tiebreaks?: string[]; // Tag 202 — codes for breaking ties
  timeControl?: string;
  useRankingId?: boolean; // XXC rank
  version: Version; // 'TRF16' | 'TRF26'
}

interface Player {
  birthDate?: string;
  federation?: string;
  fideId?: string;
  name: string;
  pairingNumber: number;
  points: number;
  rank: number;
  rating?: number;
  results: RoundResult[];
  sex?: Sex; // 'm' | 'w'
  title?: Title; // 'GM' | 'IM' | 'FM' | ...
}

interface RoundResult {
  color: 'b' | 'w' | '-'; // '-' = no color assigned (bye/unplayed)
  opponentId: number | null; // null for byes
  result: ResultCode;
  round: number;
}

interface ParseWarning {
  column: number; // 1-based column in the source
  line: number; // 1-based line in the source (player index for stringify)
  message: string;
  offset: number; // byte offset in the source (0 for stringify)
}

interface StringifyOptions {
  onWarning?: (warning: ParseWarning) => void;
}
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
