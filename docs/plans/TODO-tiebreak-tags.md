# TODO: Parse and emit tiebreak tags 202 and 212

## Problem

Tags `202` and `212` are recognized as valid TRF26 tags in the parser (listed in
`VALID_TAGS` and `TRF26_ONLY_TAGS` in `src/parse.ts`) but are silently ignored —
no `case` branch handles them, and the `Tournament` type has no field to store
the data.

## What the spec says

From SPEC.md:

| Tag   | Description                                                                                  |
| ----- | -------------------------------------------------------------------------------------------- |
| `202` | FIDE Tie-Breaks used to break ties — comma-separated list of codes from Mandatory Tie-Breaks |
| `212` | FIDE Tie-Breaks used to define standings — like 202 plus `PTS` code                          |

The value is a comma-separated list of FIDE tiebreak acronyms (e.g.,
`BH C1,BH,SB,DE`). The acronyms are defined in the FIDE Tie-Break Regulations
(Handbook C.07) and the Mandatory Tie-Breaks document at
`http://tec.fide.com/wp-content/uploads/2024/09/MandatoryTieBreaks.pdf`.

## What needs to change

### 1. Add fields to `Tournament` type (`src/types.ts`)

```typescript
interface Tournament {
  // ... existing fields ...
  tiebreaks?: string[]; // Tag 202 — codes for breaking ties
  standingsTiebreaks?: string[]; // Tag 212 — codes for defining standings (superset of 202)
}
```

### 2. Parse tags in `src/parse.ts`

Add `case '202'` and `case '212'` branches that split the value on commas and
trim whitespace:

```typescript
case '202': {
  tournament.tiebreaks = value.split(',').map(s => s.trim());
  break;
}
case '212': {
  tournament.standingsTiebreaks = value.split(',').map(s => s.trim());
  break;
}
```

### 3. Emit tags in `src/stringify.ts`

When `tournament.tiebreaks` or `tournament.standingsTiebreaks` are present, emit
the corresponding lines:

```
202 BH C1,BH,SB,DE
212 PTS,BH C1,BH,SB,DE
```

### 4. Add tests

Test round-trip: parse a TRF26 file with 202/212 tags, verify the fields are
populated, stringify back, verify the tags are emitted.

## FIDE Tiebreak Acronyms (for reference)

From the Mandatory Tie-Breaks document:

- `PTS` — Points (game points)
- `BH` — Buchholz
- `BH C1` — Buchholz Cut 1
- `BH C2` — Buchholz Cut 2
- `BH M` — Buchholz Median
- `SB` — Sonneborn-Berger
- `DE` — Direct Encounter
- `GNW` — Greater Number of Wins
- `GNB` — Greater Number of Games with Black
- `APRO` — Average Recursive Performance of Opponents
- `Koya` — Koya System (round-robin)
- `TPR` — Tournament Performance Rating
- `ARO` — Average Rating of Opponents

## Consumer

Kx8ble (`../kx8ble`) now has configurable tiebreaks per tournament. It would use
these fields to preserve tiebreak configuration during TRF import/export.
