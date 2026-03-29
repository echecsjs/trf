# TRF16 + TRF26 Compatibility Design

**Date:** 2026-03-18 **Approach:** Option A — additive types, single
`Tournament` object

## Context

The library currently parses and stringifies TRF16 only. The `Version` type
already has `'TRF16' | 'TRF26'` but `detectVersion()` always returns `'TRF16'`.
The `001` player record column layout is identical between TRF16 and TRF26 — all
differences are additive (new record types, new tags).

Three pre-existing tag mapping bugs are fixed as part of this work:

- `092` is "Type of tournament" (was incorrectly mapped to `chiefArbiter`)
- `102` is "Chief Arbiter" (was silently ignored)
- `112` is "Deputy Chief Arbiter" (was incorrectly mapped to `timeControl`)
- `122` is "Allotted times per moves/game" (the real time control, was silently
  ignored)

## Section 1 — Version Detection

`detectVersion(lines: string[])` pre-scans all lines before the main parse loop.
Returns `'TRF26'` if any TRF26-only tag or record type is present:

TRF26-only indicators: `###`, `142`, `152`, `162`, `172`, `182`, `192`, `202`,
`212`, `222`, `250`, `260`, `299`, `300`, `310`, `320`, `330`, `352`, `362`,
`801`, `802`, or any line whose first 3 characters match `[A-Z]{3}` (NRS
record).

Otherwise returns `'TRF16'`.

## Section 2 — New Types (`types.ts`)

### ResultCode

```ts
type ResultCode =
  | '+'
  | '-'
  | '0'
  | '1'
  | '='
  | 'D'
  | 'F'
  | 'H'
  | 'L'
  | 'U'
  | 'W'
  | 'Z';
```

TRF26 adds `'D'`, `'L'`, `'W'` for unrated games lasting less than one move.

### New interfaces (all fields sorted alphabetically)

```ts
interface AcceleratedRound {
  firstPlayerId: number;
  firstRound: number;
  gamePoints: number;
  lastPlayerId: number;
  lastRound: number;
  matchPoints: number; // 0.0 for individual tournaments
}

interface AbnormalPoints {
  gamePoints: number;
  matchPoints: number; // 0.0 for individuals
  playerIds: number[]; // empty = all players/teams
  round: number; // 0 = all rounds
  type: ' ' | '+' | '-' | 'D' | 'F' | 'H' | 'L' | 'W' | 'Z';
}

interface Bye {
  playerIds: number[];
  round: number;
  type: 'F' | 'H' | 'Z';
}

interface ForfeitedMatch {
  blackTeamId: number;
  round: number;
  type: '--' | '-+' | '+-';
  whiteTeamId: number;
}

interface NationalRating {
  birthDate?: string;
  classification?: string;
  federation: string; // 3-letter FIDE code — the NRS record type prefix
  name?: string;
  nationalId?: string;
  origin?: string;
  pairingNumber: number;
  rating: number;
  sex?: Sex;
}

interface OutOfOrderLineup {
  opponentTeamId: number;
  playerIds: (number | null)[]; // null = unoccupied board
  round: number;
  teamId: number;
}

interface ProhibitedPairing {
  firstRound: number;
  lastRound: number;
  playerIds: number[];
}

interface Team {
  gamePoints: number;
  matchPoints: number;
  name: string;
  nickname?: string;
  pairingNumber: number;
  playerIds: number[];
  rank: number;
  strengthFactor?: number;
}

interface TeamPairingAllocatedBye {
  gamePoints: number;
  matchPoints: number;
  teamIdPerRound: (number | null)[]; // index = round - 1, null = no PAB that round
}
```

### Extended `Player`

```ts
interface Player {
  birthDate?: string;
  federation?: string;
  fideId?: string;
  name: string;
  nationalRatings?: NationalRating[]; // NEW — NRS records
  pairingNumber: number;
  points: number;
  rank: number;
  rating?: number;
  results: RoundResult[];
  sex?: Sex;
  title?: Title;
}
```

### Extended `Tournament`

```ts
interface Tournament {
  acceleratedRounds?: AcceleratedRound[]; // NEW — 250
  abnormalPoints?: AbnormalPoints[]; // NEW — 299
  byes?: Bye[]; // NEW — 240
  chiefArbiter?: string; // FIXED — now 102 (was 092)
  city?: string; // 022
  comments?: string[]; // NEW — ### lines
  deputyArbiters?: string[]; // FIXED — now 112 (was stored as timeControl)
  endDate?: string; // 052
  federation?: string; // 032
  forfeitedMatches?: ForfeitedMatch[]; // NEW — 330
  initialColour?: 'B' | 'W'; // NEW — 152
  name?: string; // 012
  numberOfPlayers?: number; // FIXED — now stored (was silenced, 062)
  numberOfRatedPlayers?: number; // FIXED — now stored (was silenced, 072)
  numberOfTeams?: number; // FIXED — now stored (was silenced, 082)
  outOfOrderLineups?: OutOfOrderLineup[]; // NEW — 300
  pairingController?: string; // NEW — 182
  players: Player[];
  prohibitedPairings?: ProhibitedPairing[]; // NEW — 260
  rounds: number; // XXR / 142
  startDate?: string; // 042
  teamPairingAllocatedByes?: TeamPairingAllocatedBye; // NEW — 320
  teams?: Team[]; // NEW — 310 (replaces 013)
  timeControl?: string; // FIXED — now 122 (was 112)
  tournamentType?: string; // FIXED — now 092 (was stored as chiefArbiter)
  version: Version;
}
```

Tags `162`, `172`, `192`, `202`, `212`, `222`, `352`, `362` are recognised (no
unknown-tag warning) but not stored — they are complex structured fields
deferred to a future iteration.

## Section 3 — Parse Changes

1. **Pre-scan** `detectVersion(lines)` before the main loop; pass `version` into
   the tournament object.
2. **`###`** comment lines → `tournament.comments` array.
3. **Tag mapping fixes:**
   - `092` → `tournament.tournamentType`
   - `102` → `tournament.chiefArbiter`
   - `112` → push to `tournament.deputyArbiters`
   - `122` → `tournament.timeControl`
4. **Previously silenced tags now stored:** `062` → `numberOfPlayers`, `072` →
   `numberOfRatedPlayers`, `082` → `numberOfTeams`.
5. **New TRF26-only simple tags:** `152` → `initialColour`, `182` →
   `pairingController`.
6. **`142`** treated as alias for `XXR` (both set `tournament.rounds`).
7. **Tags `162`, `172`, `192`, `202`, `212`, `222`, `352`, `362`** — added to
   `KNOWN_HEADER_TAGS` (no warning, value not stored).
8. **New record types fully parsed:**
   - `240` → `tournament.byes`
   - `250` → `tournament.acceleratedRounds`
   - `260` → `tournament.prohibitedPairings`
   - `299` → `tournament.abnormalPoints`
   - `300` → `tournament.outOfOrderLineups`
   - `310` → `tournament.teams`
   - `320` → `tournament.teamPairingAllocatedByes`
   - `330` → `tournament.forfeitedMatches`
9. **NRS records** — tag matching `[A-Z]{3}` and not in `KNOWN_HEADER_TAGS` →
   parsed into `NationalRating`, pushed to the matching player's
   `nationalRatings` array.
10. **`801` / `802`** — added to `KNOWN_HEADER_TAGS` (informative, no warning,
    skipped).
11. **New result codes** `'W'`, `'D'`, `'L'` added to `VALID_RESULT_CODES`.

## Section 4 — Stringify Changes

1. **Tag mapping fixes:** emit `092` for `tournamentType`, `102` for
   `chiefArbiter`, `112` for each entry in `deputyArbiters`, `122` for
   `timeControl`.
2. **`###` comments** — emitted first, before any other tags.
3. **New simple tags:** emit `062`, `072`, `082`, `152`, `182` when the
   corresponding field is present.
4. **`XXR` vs `142`:** always emit `XXR` (broadest compatibility); additionally
   emit `142` when `version === 'TRF26'`.
5. **New TRF26 record types** — emitted only when `version === 'TRF26'` and the
   field is present: `240`, `250`, `260`, `299`, `300`, `310`, `320`, `330`.
6. **NRS records** — emitted after all `001` records when any player has
   `nationalRatings`.
7. **`801` / `802`** — never emitted.
8. **Record ordering:** comments → tournament tags (012–362) → `XXR`/`142` →
   `001` player records → NRS records → `310` team records →
   `240`/`250`/`260`/`299`/`300`/`320`/`330` records.

## Out of Scope (deferred)

- Full structured parsing/stringifying of tags `162`, `172`, `192`, `202`,
  `212`, `222`, `352`, `362`
- Record `013` (legacy team record — TRF26 replaces it with `310`; parse for
  backward compat, do not stringify)
- Records `801` / `802` (informative only)
