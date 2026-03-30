# TRFx Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Parse and stringify JaVaFo TRFx extension tags (XXC, XXZ, XXP, XXA,
XXS) so the library can read/write files produced by JaVaFo and all tournament
software built on it.

**Architecture:** Add new fields and one new type to
`Tournament`/`ScoringSystem`, extend the parser switch with five new cases,
extend the stringifier with corresponding output logic. Each tag is independent
— implement one at a time with TDD.

**Tech Stack:** TypeScript, Vitest, ESM-only. No runtime dependencies.

**Design doc:** `docs/plans/2026-03-30-trfx-support-design.md`

**Reference specs:**

- `SPEC-supplement.md` — full TRFx format documentation
- `src/types.ts` — all type definitions (fields sorted alphabetically, ESLint
  enforced)
- `src/parse.ts` — parser (KNOWN_HEADER_TAGS at line ~35, case switch at ~350+)
- `src/stringify.ts` — serializer (TRF26 block at ~208+)

**Commands:**

- Test: `pnpm run test`
- Lint: `pnpm run lint`
- Build: `pnpm run build`
- Full check: `pnpm lint && pnpm test && pnpm build`

---

### Task 1: XXC — Configuration (rank flag + first colour)

**Files:**

- Modify: `src/types.ts` — add `useRankingId?: boolean` to `Tournament`
- Modify: `src/parse.ts` — replace silent `XXC` handling with actual parser
- Modify: `src/stringify.ts` — emit `XXC` line for TRF16 version
- Test: `src/__tests__/index.spec.ts`
- Test: `src/__tests__/stringify.spec.ts`

**Step 1: Write the failing tests**

In `src/__tests__/index.spec.ts`, add a new describe block:

```typescript
describe('parse — XXC (TRFx configuration)', () => {
  it('parses XXC rank flag', () => {
    const result = parse('012 T\nXXR 9\nXXC rank\n');
    expect(result?.useRankingId).toBe(true);
  });

  it('parses XXC white1 into initialColour', () => {
    const result = parse('012 T\nXXR 9\nXXC white1\n');
    expect(result?.initialColour).toBe('W');
  });

  it('parses XXC black1 into initialColour', () => {
    const result = parse('012 T\nXXR 9\nXXC black1\n');
    expect(result?.initialColour).toBe('B');
  });

  it('parses combined XXC rank black1', () => {
    const result = parse('012 T\nXXR 9\nXXC rank black1\n');
    expect(result?.useRankingId).toBe(true);
    expect(result?.initialColour).toBe('B');
  });

  it('useRankingId is undefined when XXC absent', () => {
    expect(parse('012 T\nXXR 9\n')?.useRankingId).toBeUndefined();
  });
});
```

In `src/__tests__/stringify.spec.ts`, add:

```typescript
describe('stringify — XXC (TRFx configuration)', () => {
  it('emits XXC rank for TRF16 when useRankingId is true', () => {
    const output = stringify(minimal({ useRankingId: true }));
    expect(output).toContain('XXC rank');
  });

  it('does not emit XXC when useRankingId is undefined', () => {
    const output = stringify(minimal());
    expect(output).not.toMatch(/XXC/);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test` Expected: Multiple failures — `useRankingId` does not exist
on type.

**Step 3: Write minimal implementation**

In `src/types.ts`, add field to `Tournament` (alphabetically between
`tournamentType` and `version`):

```typescript
  useRankingId?: boolean;
```

In `src/parse.ts`, replace the existing `XXC` comment-only case (around the
`013` case area — look for the comment about XXC being silenced) with:

```typescript
      case 'XXC': {
        const tokens = line.slice(4).trim().split(/\s+/);
        for (const token of tokens) {
          if (token === 'rank') {
            tournament.useRankingId = true;
          } else if (token === 'white1') {
            tournament.initialColour = 'W';
          } else if (token === 'black1') {
            tournament.initialColour = 'B';
          }
        }
        break;
      }
```

Note: remove the old comment about XXC being silenced at the top of parse.ts
(lines ~32-34).

In `src/stringify.ts`, after the existing XXR line and before the TRF26 block,
add:

```typescript
// TRFx tags — emitted for any version when fields are present
{
  const xxcParts: string[] = [];
  if (tournament.useRankingId === true) {
    xxcParts.push('rank');
  }
  // initialColour is emitted via tag 152 in TRF26 mode,
  // but via XXC in TRF16 mode
  if (
    tournament.version !== 'TRF26' &&
    tournament.initialColour !== undefined
  ) {
    xxcParts.push(tournament.initialColour === 'W' ? 'white1' : 'black1');
  }
  if (xxcParts.length > 0) {
    lines.push(`XXC ${xxcParts.join(' ')}`);
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm run test` Expected: All pass.

**Step 5: Run lint**

Run: `pnpm run lint` Expected: Clean.

**Step 6: Commit**

```
feat: parse and stringify XXC (TRFx configuration)
```

---

### Task 2: XXZ — Absent Players

**Files:**

- Modify: `src/types.ts` — add `absentPlayers?: number[]` to `Tournament`
- Modify: `src/parse.ts` — add XXZ to KNOWN_HEADER_TAGS + case handler
- Modify: `src/stringify.ts` — emit XXZ lines
- Test: `src/__tests__/index.spec.ts`
- Test: `src/__tests__/stringify.spec.ts`

**Step 1: Write the failing tests**

In `src/__tests__/index.spec.ts`:

```typescript
describe('parse — XXZ (TRFx absent players)', () => {
  it('parses single XXZ line with multiple player IDs', () => {
    const result = parse('012 T\nXXR 9\nXXZ 3 7 12\n');
    expect(result?.absentPlayers).toEqual([3, 7, 12]);
  });

  it('concatenates multiple XXZ lines', () => {
    const result = parse('012 T\nXXR 9\nXXZ 3 7\nXXZ 12\n');
    expect(result?.absentPlayers).toEqual([3, 7, 12]);
  });

  it('absentPlayers is undefined when XXZ absent', () => {
    expect(parse('012 T\nXXR 9\n')?.absentPlayers).toBeUndefined();
  });

  it('does not emit unknown-tag warning for XXZ', () => {
    const onWarning = vi.fn();
    parse('012 T\nXXR 9\nXXZ 3\n', { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});
```

In `src/__tests__/stringify.spec.ts`:

```typescript
describe('stringify — XXZ (TRFx absent players)', () => {
  it('emits XXZ line for absentPlayers', () => {
    const output = stringify(minimal({ absentPlayers: [3, 7, 12] }));
    expect(output).toContain('XXZ 3 7 12');
  });

  it('does not emit XXZ when absentPlayers is undefined', () => {
    const output = stringify(minimal());
    expect(output).not.toMatch(/XXZ/);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm run test` Expected: Failures — `absentPlayers` does not exist on
type.

**Step 3: Write minimal implementation**

In `src/types.ts`, add to `Tournament` (alphabetically between `abnormalPoints`
and `acceleratedRounds`):

```typescript
  absentPlayers?: number[];
```

In `src/parse.ts`, add `'XXZ'` to `KNOWN_HEADER_TAGS`. Add case handler near the
other XX cases:

```typescript
      case 'XXZ': {
        const ids = line
          .slice(4)
          .trim()
          .split(/\s+/)
          .map(Number)
          .filter((n) => n > 0);
        if (ids.length > 0) {
          tournament.absentPlayers ??= [];
          tournament.absentPlayers.push(...ids);
        }
        break;
      }
```

In `src/stringify.ts`, add after the XXC block:

```typescript
if (
  tournament.absentPlayers !== undefined &&
  tournament.absentPlayers.length > 0
) {
  lines.push(`XXZ ${tournament.absentPlayers.join(' ')}`);
}
```

**Step 4: Run tests + lint**

Run: `pnpm lint && pnpm test`

**Step 5: Commit**

```
feat: parse and stringify XXZ (TRFx absent players)
```

---

### Task 3: XXP — Forbidden Pairs

**Files:**

- Modify: `src/parse.ts` — add XXP to KNOWN_HEADER_TAGS + case handler
- Modify: `src/stringify.ts` — emit XXP lines for TRF16 version
- Test: `src/__tests__/index.spec.ts`
- Test: `src/__tests__/stringify.spec.ts`

No new types needed — reuses existing `ProhibitedPairing` with
`firstRound: 0, lastRound: 0` as sentinel for "all rounds".

**Step 1: Write the failing tests**

In `src/__tests__/index.spec.ts`:

```typescript
describe('parse — XXP (TRFx forbidden pairs)', () => {
  it('parses XXP line as prohibited pairing for all rounds', () => {
    const result = parse('012 T\nXXR 9\nXXP 13 68\n');
    expect(result?.prohibitedPairings).toHaveLength(1);
    expect(result?.prohibitedPairings?.[0]?.playerIds).toEqual([13, 68]);
    expect(result?.prohibitedPairings?.[0]?.firstRound).toBe(0);
    expect(result?.prohibitedPairings?.[0]?.lastRound).toBe(0);
  });

  it('parses multiple XXP lines', () => {
    const result = parse('012 T\nXXR 9\nXXP 13 68\nXXP 78 111\n');
    expect(result?.prohibitedPairings).toHaveLength(2);
  });

  it('does not emit unknown-tag warning for XXP', () => {
    const onWarning = vi.fn();
    parse('012 T\nXXR 9\nXXP 1 2\n', { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});
```

In `src/__tests__/stringify.spec.ts`:

```typescript
describe('stringify — XXP (TRFx forbidden pairs)', () => {
  it('emits XXP for prohibited pairings with round 0/0', () => {
    const output = stringify(
      minimal({
        prohibitedPairings: [
          { firstRound: 0, lastRound: 0, playerIds: [13, 68] },
        ],
      }),
    );
    expect(output).toContain('XXP 13 68');
  });

  it('does not emit XXP for tag 260 pairings (non-zero rounds)', () => {
    const output = stringify(
      minimal({
        prohibitedPairings: [
          { firstRound: 1, lastRound: 3, playerIds: [13, 68] },
        ],
        version: 'TRF16',
      }),
    );
    expect(output).not.toMatch(/XXP/);
  });
});
```

**Step 2: Verify RED**

Run: `pnpm run test`

**Step 3: Implement**

In `src/parse.ts`, add `'XXP'` to `KNOWN_HEADER_TAGS`. Add case:

```typescript
      case 'XXP': {
        const ids = line
          .slice(4)
          .trim()
          .split(/\s+/)
          .map(Number)
          .filter((n) => n > 0);
        if (ids.length > 0) {
          tournament.prohibitedPairings ??= [];
          tournament.prohibitedPairings.push({
            firstRound: 0,
            lastRound: 0,
            playerIds: ids,
          });
        }
        break;
      }
```

In `src/stringify.ts`, in the section where `prohibitedPairings` is serialized
(for tag 260), add logic to also emit XXP for entries with
`firstRound === 0 && lastRound === 0`:

```typescript
if (tournament.prohibitedPairings !== undefined) {
  for (const pp of tournament.prohibitedPairings) {
    if (pp.firstRound === 0 && pp.lastRound === 0) {
      lines.push(`XXP ${pp.playerIds.join(' ')}`);
    }
  }
}
```

**Step 4: Run tests + lint**

**Step 5: Commit**

```
feat: parse and stringify XXP (TRFx forbidden pairs)
```

---

### Task 4: XXA — Accelerated Rounds (per-player)

**Files:**

- Modify: `src/types.ts` — add `PlayerAcceleration` interface +
  `playerAccelerations` field + export
- Modify: `src/index.ts` — export `PlayerAcceleration` type
- Modify: `src/parse.ts` — add XXA to KNOWN_HEADER_TAGS + case handler
- Modify: `src/stringify.ts` — emit XXA lines
- Test: `src/__tests__/index.spec.ts`
- Test: `src/__tests__/stringify.spec.ts`

**Step 1: Write the failing tests**

In `src/__tests__/index.spec.ts`:

```typescript
describe('parse — XXA (TRFx player accelerations)', () => {
  it('parses XXA line with player ID and per-round points', () => {
    const result = parse('012 T\nXXR 9\nXXA    1  0.5  0.5  0.0\n');
    expect(result?.playerAccelerations).toHaveLength(1);
    expect(result?.playerAccelerations?.[0]?.pairingNumber).toBe(1);
    expect(result?.playerAccelerations?.[0]?.points).toEqual([0.5, 0.5, 0]);
  });

  it('parses multiple XXA lines for different players', () => {
    const result = parse(
      '012 T\nXXR 9\nXXA    1  0.5  0.5\nXXA    2  0.5  0.0\n',
    );
    expect(result?.playerAccelerations).toHaveLength(2);
    expect(result?.playerAccelerations?.[1]?.pairingNumber).toBe(2);
  });

  it('playerAccelerations is undefined when XXA absent', () => {
    expect(parse('012 T\nXXR 9\n')?.playerAccelerations).toBeUndefined();
  });

  it('does not emit unknown-tag warning for XXA', () => {
    const onWarning = vi.fn();
    parse('012 T\nXXR 9\nXXA    1  0.5\n', { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});
```

In `src/__tests__/stringify.spec.ts`:

```typescript
describe('stringify — XXA (TRFx player accelerations)', () => {
  it('emits XXA line for each player acceleration', () => {
    const output = stringify(
      minimal({
        playerAccelerations: [{ pairingNumber: 1, points: [0.5, 0.5, 0] }],
      }),
    );
    expect(output).toMatch(/XXA\s+1\s+0\.5\s+0\.5\s+0\.0/);
  });
});
```

**Step 2: Verify RED**

**Step 3: Implement**

In `src/types.ts`, add interface (alphabetically before `ParseError`):

```typescript
interface PlayerAcceleration {
  pairingNumber: number;
  points: number[];
}
```

Add field to `Tournament` (alphabetically between `players` and
`prohibitedPairings`):

```typescript
  playerAccelerations?: PlayerAcceleration[];
```

Add to export list.

In `src/index.ts`, add `PlayerAcceleration` to the type exports.

In `src/parse.ts`, add `'XXA'` to `KNOWN_HEADER_TAGS`. Add case:

```typescript
      case 'XXA': {
        const playerId = Number(line.slice(4, 8).trim());
        if (playerId > 0) {
          const points: number[] = [];
          for (let pos = 9; pos < line.length; pos += 5) {
            const raw = line.slice(pos, pos + 4).trim();
            if (raw.length === 0) continue;
            const pts = Number(raw);
            if (!Number.isNaN(pts)) {
              points.push(pts);
            }
          }
          tournament.playerAccelerations ??= [];
          tournament.playerAccelerations.push({ pairingNumber: playerId, points });
        }
        break;
      }
```

In `src/stringify.ts`, add after XXZ block:

```typescript
if (tournament.playerAccelerations !== undefined) {
  for (const pa of tournament.playerAccelerations) {
    const id = pad(String(pa.pairingNumber), 4, 'right');
    const pts = pa.points.map((p) => pad(p.toFixed(1), 4, 'right')).join(' ');
    lines.push(`XXA ${id} ${pts}`);
  }
}
```

**Step 4: Run tests + lint**

**Step 5: Commit**

```
feat: parse and stringify XXA (TRFx player accelerations)
```

---

### Task 5: XXS — Extended Scoring System

**Files:**

- Modify: `src/types.ts` — add 11 fields to `ScoringSystem`
- Modify: `src/parse.ts` — add XXS to KNOWN_HEADER_TAGS + case handler
- Modify: `src/stringify.ts` — emit XXS lines when colour-specific fields
  present
- Test: `src/__tests__/index.spec.ts`
- Test: `src/__tests__/stringify.spec.ts`

**Step 1: Write the failing tests**

In `src/__tests__/index.spec.ts`:

```typescript
describe('parse — XXS (TRFx scoring system)', () => {
  it('parses XXS with simple codes', () => {
    const result = parse('012 T\nXXR 9\nXXS WW=1.5 BW=1.0\n');
    expect(result?.scoringSystem?.whiteWin).toBe(1.5);
    expect(result?.scoringSystem?.blackWin).toBe(1);
  });

  it('parses shortcut W expanding to whiteWin, blackWin, forfeitWin, fullPointBye', () => {
    const result = parse('012 T\nXXR 9\nXXS W=3\n');
    expect(result?.scoringSystem?.whiteWin).toBe(3);
    expect(result?.scoringSystem?.blackWin).toBe(3);
    expect(result?.scoringSystem?.forfeitWin).toBe(3);
    expect(result?.scoringSystem?.fullPointBye).toBe(3);
  });

  it('parses shortcut D expanding to whiteDraw, blackDraw, halfPointBye', () => {
    const result = parse('012 T\nXXR 9\nXXS D=1\n');
    expect(result?.scoringSystem?.whiteDraw).toBe(1);
    expect(result?.scoringSystem?.blackDraw).toBe(1);
    expect(result?.scoringSystem?.halfPointBye).toBe(1);
  });

  it('last value wins when shortcut and specific code both used', () => {
    const result = parse('012 T\nXXR 9\nXXS W=3 WW=2\n');
    expect(result?.scoringSystem?.whiteWin).toBe(2);
    expect(result?.scoringSystem?.blackWin).toBe(3);
  });

  it('accumulates across multiple XXS lines', () => {
    const result = parse('012 T\nXXR 9\nXXS W=3\nXXS D=1\n');
    expect(result?.scoringSystem?.whiteWin).toBe(3);
    expect(result?.scoringSystem?.whiteDraw).toBe(1);
  });

  it('parses all 12 individual codes', () => {
    const input =
      '012 T\nXXR 9\nXXS WW=1 BW=1 WD=0.5 BD=0.5 WL=0 BL=0\n' +
      'XXS ZPB=0 HPB=0.5 FPB=1 PAB=1 FW=1 FL=0\n';
    const result = parse(input);
    expect(result?.scoringSystem?.whiteWin).toBe(1);
    expect(result?.scoringSystem?.blackWin).toBe(1);
    expect(result?.scoringSystem?.whiteDraw).toBe(0.5);
    expect(result?.scoringSystem?.blackDraw).toBe(0.5);
    expect(result?.scoringSystem?.whiteLoss).toBe(0);
    expect(result?.scoringSystem?.blackLoss).toBe(0);
    expect(result?.scoringSystem?.zeroPointBye).toBe(0);
    expect(result?.scoringSystem?.halfPointBye).toBe(0.5);
    expect(result?.scoringSystem?.fullPointBye).toBe(1);
    expect(result?.scoringSystem?.pairingAllocatedBye).toBe(1);
    expect(result?.scoringSystem?.forfeitWin).toBe(1);
    expect(result?.scoringSystem?.forfeitLoss).toBe(0);
  });

  it('does not emit unknown-tag warning for XXS', () => {
    const onWarning = vi.fn();
    parse('012 T\nXXR 9\nXXS W=1\n', { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});
```

In `src/__tests__/stringify.spec.ts`:

```typescript
describe('stringify — XXS (TRFx scoring system)', () => {
  it('emits XXS for colour-specific scoring fields', () => {
    const output = stringify(
      minimal({
        scoringSystem: { blackWin: 1, whiteWin: 1.5 },
      }),
    );
    expect(output).toMatch(/XXS/);
    expect(output).toMatch(/WW=1\.5/);
    expect(output).toMatch(/BW=1\.0/);
  });

  it('does not emit XXS when only tag-162 fields are set', () => {
    const output = stringify(
      minimal({
        scoringSystem: { win: 3 },
        version: 'TRF26',
      }),
    );
    expect(output).not.toMatch(/XXS/);
  });
});
```

**Step 2: Verify RED**

**Step 3: Implement**

In `src/types.ts`, extend `ScoringSystem` with 11 new optional fields
(alphabetically):

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

In `src/parse.ts`, add `'XXS'` to `KNOWN_HEADER_TAGS`. Add case:

```typescript
      case 'XXS': {
        tournament.scoringSystem ??= {};
        const pairs = line.slice(4).trim().split(/\s+/);
        for (const pair of pairs) {
          const [code, rawVal] = pair.split('=');
          if (code === undefined || rawVal === undefined) continue;
          const val = Number(rawVal);
          if (Number.isNaN(val)) continue;
          switch (code) {
            case 'W':
              tournament.scoringSystem.whiteWin = val;
              tournament.scoringSystem.blackWin = val;
              tournament.scoringSystem.forfeitWin = val;
              tournament.scoringSystem.fullPointBye = val;
              break;
            case 'D':
              tournament.scoringSystem.whiteDraw = val;
              tournament.scoringSystem.blackDraw = val;
              tournament.scoringSystem.halfPointBye = val;
              break;
            case 'WW':
              tournament.scoringSystem.whiteWin = val;
              break;
            case 'BW':
              tournament.scoringSystem.blackWin = val;
              break;
            case 'WD':
              tournament.scoringSystem.whiteDraw = val;
              break;
            case 'BD':
              tournament.scoringSystem.blackDraw = val;
              break;
            case 'WL':
              tournament.scoringSystem.whiteLoss = val;
              break;
            case 'BL':
              tournament.scoringSystem.blackLoss = val;
              break;
            case 'ZPB':
              tournament.scoringSystem.zeroPointBye = val;
              break;
            case 'HPB':
              tournament.scoringSystem.halfPointBye = val;
              break;
            case 'FPB':
              tournament.scoringSystem.fullPointBye = val;
              break;
            case 'PAB':
              tournament.scoringSystem.pairingAllocatedBye = val;
              break;
            case 'FW':
              tournament.scoringSystem.forfeitWin = val;
              break;
            case 'FL':
              tournament.scoringSystem.forfeitLoss = val;
              break;
            default:
              break;
          }
        }
        break;
      }
```

In `src/stringify.ts`, add XXS emission for colour-specific fields. Define the
XXS-only fields as a list and emit a single XXS line if any are present:

```typescript
if (tournament.scoringSystem !== undefined) {
  const s = tournament.scoringSystem;
  const xxsEntries: string[] = [];
  const xxsFields: [string, number | undefined][] = [
    ['WW', s.whiteWin],
    ['BW', s.blackWin],
    ['WD', s.whiteDraw],
    ['BD', s.blackDraw],
    ['WL', s.whiteLoss],
    ['BL', s.blackLoss],
    ['ZPB', s.zeroPointBye],
    ['HPB', s.halfPointBye],
    ['FPB', s.fullPointBye],
    ['PAB', s.pairingAllocatedBye],
    ['FW', s.forfeitWin],
    ['FL', s.forfeitLoss],
  ];
  for (const [code, val] of xxsFields) {
    if (val !== undefined) {
      xxsEntries.push(`${code}=${val.toFixed(1)}`);
    }
  }
  if (xxsEntries.length > 0) {
    lines.push(`XXS ${xxsEntries.join(' ')}`);
  }
}
```

Note: `pairingAllocatedBye` is shared between tag 162 (`P`) and XXS (`PAB`).
When both are present, emit via 162 in TRF26 mode, via XXS otherwise. The
stringify logic for tag 162 already handles the symmetric fields — the XXS block
above only emits the colour-specific XXS codes. However, `pairingAllocatedBye`
should be emitted via XXS only when other XXS-specific fields are present.
Adjust the filter condition: only emit the `PAB` entry if any colour-specific
field is also defined.

**Step 4: Run tests + lint**

**Step 5: Commit**

```
feat: parse and stringify XXS (TRFx scoring system)
```

---

### Task 6: Update backlog + final verification

**Step 1:** Remove the TRFx item from `BACKLOG.md`.

**Step 2:** Run full verification:

```bash
pnpm lint && pnpm test && pnpm build
```

**Step 3: Commit**

```
chore: remove completed TRFx item from backlog
```
