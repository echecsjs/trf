# Changelog

## 3.4.0 — 2026-04-18

### Added

- Tags `801` and `802` — informative team round-by-round results. Tag `802`
  parsed into structured fields (opponent, color, game points, forfeit
  indicator, bye types). Tag `801` stores raw per-round strings (board-level
  detail is undocumented in the spec). New `Tournament.teamRoundResults` field.
- New exported types: `TeamRoundResult`, `TeamRoundResult801`,
  `TeamRoundResult802`.

## 3.3.2 — 2026-04-09

### Changed

- updated description to mention stringify

## 3.3.1 — 2026-04-09

### Fixed

- completed `Tournament` interface documentation (added 15 missing fields)
- documented `Player.nationalRatings` field
- added missing `ResultCode` values (`D`, `L`, `W`)
- documented all exported types
- distinguished `ParseError` from `ParseWarning`

## 3.3.0 — 2026-03-30

### Added

- Tag `162` — Scoring point system for individuals. New `ScoringSystem`
  interface with fields: `win`, `draw`, `loss`, `absence`,
  `pairingAllocatedBye`, `unknown`. Stored in `Tournament.scoringSystem`.
- Tag `192` — Encoded tournament type. New `Tournament.encodedTournamentType`
  field (separate from the free-form `092` `tournamentType`).
- Tags `172`, `222`, `352`, `362` — Raw string passthrough. New fields:
  `startingRankMethod`, `encodedTimeControl`, `colourSequence`,
  `teamScoringSystem`. Values preserved on round-trip.
- Full TRFx support — JaVaFo extension tags (`XXC`, `XXZ`, `XXP`, `XXA`, `XXS`)
  are now parsed and stringified.
- `XXC` — Configuration: `Tournament.useRankingId` for rank mode,
  `white1`/`black1` mapped to existing `initialColour`.
- `XXZ` — Absent players: new `Tournament.absentPlayers` field.
- `XXP` — Forbidden pairs: stored as `prohibitedPairings` with round 0/0
  sentinel (coexists with tag `260` entries).
- `XXA` — Per-player accelerations: new `PlayerAcceleration` type and
  `Tournament.playerAccelerations` field.
- `XXS` — Extended scoring system: 11 new colour-specific fields on
  `ScoringSystem` (`whiteWin`, `blackWin`, `whiteDraw`, `blackDraw`,
  `whiteLoss`, `blackLoss`, `forfeitWin`, `forfeitLoss`, `fullPointBye`,
  `halfPointBye`, `zeroPointBye`). Supports shortcut expansion (`W`, `D`) and
  last-value-wins semantics.
- New exported types: `PlayerAcceleration`, `ScoringSystem`.

## 3.2.0 — 2026-03-29

### Added

- Parsed and stringified tiebreak tags `202` and `212` (TRF26). New
  `Tournament.tiebreaks` and `Tournament.standingsTiebreaks` fields store the
  comma-separated FIDE tiebreak codes.

## 3.1.1 — 2026-03-21

### Fixed

- `eslint-config-prettier` moved to end of ESLint config array, preventing
  ESLint auto-fix from re-introducing formatting that Prettier rejects.

## 3.1.0 — 2026-03-19

### Added

- Full TRF26 parse and stringify support. The `version` field on `Tournament` is
  now auto-detected from file content (`'TRF16'` or `'TRF26'`).
- New `Tournament` fields: `abnormalPoints`, `acceleratedRounds`, `byes`,
  `comments`, `deputyArbiters`, `forfeitedMatches`, `initialColour`,
  `numberOfPlayers`, `numberOfRatedPlayers`, `numberOfTeams`,
  `outOfOrderLineups`, `pairingController`, `prohibitedPairings`, `roundDates`,
  `teamPairingAllocatedByes`, `teams`, `tournamentType`.
- New `Player.nationalRatings` field for NRS (National Rating Support) records.
- New exported types: `AcceleratedRound`, `AbnormalPoints`, `Bye`,
  `ForfeitedMatch`, `NationalRating`, `OutOfOrderLineup`, `ProhibitedPairing`,
  `Team`, `TeamPairingAllocatedBye`.
- TRF26 record types parsed and stringified: `240` (byes), `250` (accelerated
  rounds), `260` (prohibited pairings), `299` (abnormal points), `300`
  (out-of-order lineups), `310` (teams), `320` (team PAB), `330` (forfeited
  matches).
- Legacy `013` team records accepted silently for backward compatibility.
- New result codes `'W'`, `'D'`, `'L'` (unrated games lasting less than one
  move).
- Round dates (`132` tag) parsed into `Tournament.roundDates` and stringified.
- `###` comment lines collected into `Tournament.comments` and re-emitted on
  stringify for TRF26 files.

### Fixed

- Tag `092` now correctly maps to `tournamentType` (was `chiefArbiter`).
- Tag `102` now correctly maps to `chiefArbiter` (was silently ignored).
- Tag `112` now correctly maps to `deputyArbiters` (was `timeControl`).
- Tag `122` now correctly maps to `timeControl` (was silently ignored).
- Tags `062`, `072`, `082` now stored as `numberOfPlayers`,
  `numberOfRatedPlayers`, `numberOfTeams` (were silently ignored).

## 3.0.0 — 2026-03-18

### Breaking Changes

- `RoundResult.color` is now `'b' | 'w' | '-'`. The `-` value represents entries
  with no color assigned (byes, unplayed games). Previously these were silently
  normalised to `'b'`, losing information.

### Fixed

- Parse and stringify now roundtrip `-` color entries faithfully.

## 2.1.0 — 2026-03-17

### Added

- `stringify()` now accepts an optional `StringifyOptions` second argument.
- `StringifyOptions.onWarning` fires when a player string field (`name`,
  `federation`, `fideId`, `birthDate`) exceeds its TRF column width and will be
  truncated. Output is always produced.
- New exported type: `StringifyOptions`.

## 2.0.0 — 2026-03-17

### Breaking Changes

- `parse` is no longer the default export. Update imports:
  ```ts
  // before
  import parse from '@echecs/trf';
  // after
  import { parse } from '@echecs/trf';
  ```

### Added

- `stringify(tournament: Tournament): string` — serializes a `Tournament` object
  to TRF16 format. The inverse of `parse()`.

### Changed

- `src/index.ts` is now a re-export barrel; logic lives in `src/parse.ts` and
  `src/stringify.ts`.

## 1.0.0 — 2026-03-17

First stable release. All known issues resolved:

- Accurate `line`/`column`/`offset` positions in `ParseError` and `ParseWarning`
- Full optional player field coverage: `sex`, `title`, `fideId`, `birthDate`,
  `federation`
- Real-world fixture tests from JaVaFo (TRFXSample2) and FIDE TEC
  (GrandMommysCup TRF25 sample)
- JaVaFo backward-compatible title codes (`g`→`GM`, `m`→`IM`, `f`→`FM`,
  `w`→`WIM`)
- Correct `Sex` type: `'m' | 'w'` per TRF16 spec
- Rating `0` treated as unrated, not a warning
- README with full usage examples and type reference
- 92 tests across 4 fixture files (bbpPairings, JaVaFo, FIDE TEC)

## 0.5.1 — 2026-03-17

- Treat rating `0` as unrated (`undefined`) rather than a warning — `0` is the
  JaVaFo convention for unrated players

## 0.5.0 — 2026-03-17

**Breaking change:** `Sex` type changed from `'f' | 'm'` to `'m' | 'w'` to match
the TRF16 spec (`w` = woman, not `f`). Any code checking `sex === 'f'` must be
updated to `sex === 'w'`.

- Fix `Sex` type: `'f'` → `'w'` (TRF16 spec uses `m`/`w`, not `m`/`f`)
- Map JaVaFo single-letter title codes: `g`→`GM`, `m`→`IM`, `f`→`FM`, `w`→`WIM`
- Add real-world fixture tests:
  - JaVaFo TRFXSample2 (52 players, Spanish open 2010, freely distributed)
  - FIDE TEC GrandMommysCup TRF25 sample (249 players, 50 teams, 14 rounds)
- 29 new tests — 92 total

## 0.4.0 — 2026-03-17

- Add tests for all optional player fields: `sex`, `title`, `fideId`,
  `birthDate`, `federation`
- Verify correct column offsets for all fields with a fully-populated test line
- Test blank field → `undefined` and invalid values → `undefined` for sex/title

## 0.3.0 — 2026-03-17

- `ParseError` and `ParseWarning` now report accurate `line`, `column`, and
  `offset` positions instead of stubs
- Added named column constants for all `001` player line fields
- Added position-accuracy tests for errors and warnings

## 0.2.2 — 2026-03-17

- Consolidate infrastructure fixes into a single published version

## 0.2.1 — 2026-03-17

- Fix CI formatting failures by adding `prettier.config.mjs` and
  `.prettierignore`

## 0.2.0 — 2026-03-17

- Add README with usage examples, type reference, and result code table
