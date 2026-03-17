# TRF

[![npm](https://img.shields.io/npm/v/@echecs/trf)](https://www.npmjs.com/package/@echecs/trf)
[![Test](https://github.com/mormubis/trf/actions/workflows/test.yml/badge.svg)](https://github.com/mormubis/trf/actions/workflows/test.yml)
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

Takes a `Tournament` object and returns a TRF16 string.

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
import { dutch } from '@echecs/swiss';

import type { Tournament } from '@echecs/trf';
import type { Game, Player } from '@echecs/swiss';

function toPlayers(tournament: Tournament): Player[] {
  return tournament.players.map((p) => ({
    id: String(p.pairingNumber),
    rating: p.rating,
  }));
}

function toGames(tournament: Tournament): Game[] {
  const games: Game[] = [];
  for (const player of tournament.players) {
    for (const result of player.results) {
      if (result.color !== 'w' || result.opponentId === null) continue;
      let score: 0 | 0.5 | 1;
      if (result.result === '1' || result.result === '+') score = 1;
      else if (result.result === '0' || result.result === '-') score = 0;
      else if (result.result === '=') score = 0.5;
      else continue;
      games.push({
        blackId: String(result.opponentId),
        result: score,
        round: result.round,
        whiteId: String(player.pairingNumber),
      });
    }
  }
  return games;
}

const tournament = parse(trfString)!;
const pairings = dutch(toPlayers(tournament), toGames(tournament), 5);
```

## Types

```typescript
interface Tournament {
  chiefArbiter?: string;
  city?: string;
  endDate?: string;
  federation?: string;
  name?: string;
  players: Player[];
  rounds: number;
  startDate?: string;
  timeControl?: string;
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
  color: 'b' | 'w';
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

## TRF Format Reference

The Tournament Report File (TRF) format is defined in the
[FIDE Handbook](https://handbook.fide.com/files/handbook/TRF26.pdf). The current
version is TRF16; TRF26 was introduced alongside the 2026 Dutch pairing rules.

## License

MIT
