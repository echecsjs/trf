# Team Round-by-Round Results (801/802) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parse and emit TRF26 tags 801 and 802 (informative team round-by-round
results).

**Architecture:** New types `TeamRoundResult`, `TeamRoundResult801`,
`TeamRoundResult802` added to `types.ts`. Parser gets two new `case` branches
(801, 802) in the tag switch. Stringify emits them after 310 team records. 802
uses structured fixed-column parsing; 801 stores raw per-round strings.

**Tech Stack:** TypeScript, Vitest

---

## File Structure

| File                          | Action | Responsibility                                         |
| ----------------------------- | ------ | ------------------------------------------------------ |
| `src/types.ts`                | Modify | Add 3 new interfaces + field on `Tournament` + exports |
| `src/index.ts`                | Modify | Re-export new types                                    |
| `src/parse.ts`                | Modify | Add `case '801'` and `case '802'` in tag switch        |
| `src/stringify.ts`            | Modify | Emit 801/802 records after team records                |
| `src/__tests__/index.spec.ts` | Modify | Tests for parse + stringify of both tags               |

---

### Task 1: Add types

**Files:**

- Modify: `src/types.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add interfaces to `src/types.ts`**

Insert before the `Team` interface (after `RoundResult`, line 101). Fields
sorted alphabetically per project convention:

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
  raw: string;
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

- [ ] **Step 2: Add `teamRoundResults` to `Tournament` interface**

In the `Tournament` interface, add between `teamPairingAllocatedByes` and
`teamScoringSystem` (alphabetical order):

```typescript
  teamRoundResults?: TeamRoundResult[];
```

- [ ] **Step 3: Add to exports in `src/types.ts`**

Add `TeamRoundResult`, `TeamRoundResult801`, `TeamRoundResult802` to the
`export type` block (alphabetical):

```typescript
export type {
  AcceleratedRound,
  AbnormalPoints,
  Bye,
  ForfeitedMatch,
  NationalRating,
  OutOfOrderLineup,
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  PlayerAcceleration,
  ProhibitedPairing,
  ResultCode,
  RoundResult,
  ScoringSystem,
  Sex,
  StringifyOptions,
  Team,
  TeamPairingAllocatedBye,
  TeamRoundResult,
  TeamRoundResult801,
  TeamRoundResult802,
  Title,
  Tournament,
  Version,
};
```

- [ ] **Step 4: Re-export from `src/index.ts`**

Add `TeamRoundResult`, `TeamRoundResult801`, `TeamRoundResult802` to the
re-export block:

```typescript
export type {
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  PlayerAcceleration,
  ResultCode,
  RoundResult,
  ScoringSystem,
  Sex,
  StringifyOptions,
  TeamRoundResult,
  TeamRoundResult801,
  TeamRoundResult802,
  Title,
  Tournament,
  Version,
} from './types.js';
```

- [ ] **Step 5: Run type check**

Run: `pnpm run lint:types` Expected: PASS (no type errors)

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/index.ts
git commit -m "feat: add TeamRoundResult types for 801/802 tags"
```

---

### Task 2: Parse tag 802

**Files:**

- Modify: `src/parse.ts`
- Modify: `src/__tests__/index.spec.ts`

802 column layout (0-indexed):

- 0-2: tag `802`
- 4-6: team pairing number (3 chars, right-aligned)
- 8-12: team nickname (5 chars, left-aligned)
- 14-19: total match points (6 chars, right-aligned)
- 21-26: total game points (6 chars, right-aligned)
- 28+: repeating 13-char blocks per round

Each 13-char round block (offsets within block):

- 0-2: opponent id (3 chars) or bye type (`FPB`/`HPB`/`PAB`/`ZPB`)
- 4: color (`w`/`b` or empty for bye)
- 6-9: game points (4 chars)
- 10: forfeit indicator (`f`/`F` or empty)

- [ ] **Step 1: Write failing tests for 802 parsing**

Add to `src/__tests__/index.spec.ts` at end of file:

```typescript
describe('parse — team round results (802)', () => {
  it('parses 802 records from grandmommyscup fixture', () => {
    const result = parse(fixture('grandmommyscup'));
    const records802 = result?.teamRoundResults?.filter((r) => r.tag === '802');
    expect(records802).toBeDefined();
    expect(records802!.length).toBeGreaterThan(0);

    // Team 1 (IND): 14 rounds, no byes, no forfeits
    const team1 = records802!.find((r) => r.teamId === 1);
    expect(team1).toBeDefined();
    expect(team1!.matchPoints).toBe(15);
    expect(team1!.gamePoints).toBe(28);
    expect(team1!.nickname).toBe('IND');
    expect(team1!.results).toHaveLength(14);

    const r1 = team1!.results[0] as TeamRoundResult802;
    expect(r1.round).toBe(1);
    expect(r1.opponentId).toBe(14);
    expect(r1.color).toBe('b');
    expect(r1.gamePoints).toBe(2);
    expect(r1.forfeit).toBeUndefined();
    expect(r1.type).toBeUndefined();
  });

  it('parses 802 bye types (FPB, HPB, ZPB)', () => {
    const result = parse(fixture('grandmommyscup'));
    const records802 = result?.teamRoundResults?.filter((r) => r.tag === '802');

    // Team 3 (GEO): round 1 is FPB
    const team3 = records802!.find((r) => r.teamId === 3);
    const round1 = team3!.results[0] as TeamRoundResult802;
    expect(round1.type).toBe('FPB');
    expect(round1.opponentId).toBeNull();
    expect(round1.gamePoints).toBe(4);
    expect(round1.color).toBeUndefined();

    // Team 7 (USA): round 2 is HPB, round 9+ are ZPB
    const team7 = records802!.find((r) => r.teamId === 7);
    const round2 = team7!.results[1] as TeamRoundResult802;
    expect(round2.type).toBe('HPB');
    expect(round2.opponentId).toBeNull();
    expect(round2.gamePoints).toBe(2);

    const round9 = team7!.results[8] as TeamRoundResult802;
    expect(round9.type).toBe('ZPB');
    expect(round9.gamePoints).toBe(0);
  });

  it('parses 802 forfeit indicator', () => {
    const result = parse(fixture('grandmommyscup'));
    const records802 = result?.teamRoundResults?.filter((r) => r.tag === '802');

    // Team 2 (UKR): round 6 has forfeit
    const team2 = records802!.find((r) => r.teamId === 2);
    const round6 = team2!.results[5] as TeamRoundResult802;
    expect(round6.opponentId).toBe(24);
    expect(round6.color).toBe('b');
    expect(round6.gamePoints).toBe(0);
    expect(round6.forfeit).toBe(true);
  });

  it('parses 802 from inline input', () => {
    const input =
      '### trf26\n012 T\nXXR 3\n' +
      '802   1 AAA      5      8.0   2 w  2.0     3 b  1.5   FPB    4.0 \n';
    const result = parse(input);
    const rec = result?.teamRoundResults?.[0];
    expect(rec).toBeDefined();
    expect(rec!.tag).toBe('802');
    expect(rec!.teamId).toBe(1);
    expect(rec!.nickname).toBe('AAA');
    expect(rec!.matchPoints).toBe(5);
    expect(rec!.gamePoints).toBe(8);
    expect(rec!.results).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/__tests__/index.spec.ts` Expected: FAIL —
`teamRoundResults` is undefined

- [ ] **Step 3: Add import for new types in `src/parse.ts`**

Add `TeamRoundResult802` to the import block in `src/parse.ts`:

```typescript
import type {
  AbnormalPoints,
  NationalRating,
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  PlayerAcceleration,
  ResultCode,
  RoundResult,
  ScoringSystem,
  Sex,
  Team,
  TeamRoundResult802,
  Title,
  Tournament,
  Version,
} from './types.js';
```

- [ ] **Step 4: Add `case '802'` to the parser switch**

Insert after the `case '310'` block (before `default:`):

```typescript
case '802': {
  const BYE_TYPES_802 = new Set(['FPB', 'HPB', 'PAB', 'ZPB']);
  const teamId802 = Number(line.slice(4, 7).trim()) || 0;
  if (teamId802 === 0) break;

  const nickname802 = line.slice(8, 13).trim() || undefined;
  const matchPoints802 = Number(line.slice(14, 20).trim()) || 0;
  const gamePoints802 = Number(line.slice(21, 27).trim()) || 0;

  const results802: TeamRoundResult802[] = [];
  let round802 = 1;
  for (let pos = 28; pos < line.length; pos += 13) {
    const block = line.slice(pos, pos + 13);
    if (block.trim().length === 0) break;

    const oppRaw = block.slice(0, 3).trim();
    const isBye = BYE_TYPES_802.has(oppRaw);

    const colorRaw = block[4]?.trim() ?? '';
    const gpRaw = block.slice(6, 10).trim();
    const forfeitRaw = block[10]?.trim() ?? '';

    const entry: TeamRoundResult802 = {
      gamePoints: Number(gpRaw) || 0,
      // eslint-disable-next-line unicorn/no-null
      opponentId: isBye ? null : Number(oppRaw) || null,
      round: round802,
    };

    if (isBye) {
      entry.type = oppRaw as 'FPB' | 'HPB' | 'PAB' | 'ZPB';
    }
    if (colorRaw === 'w' || colorRaw === 'b') {
      entry.color = colorRaw;
    }
    if (forfeitRaw === 'f' || forfeitRaw === 'F') {
      entry.forfeit = true;
    }

    results802.push(entry);
    round802 += 1;
  }

  tournament.teamRoundResults ??= [];
  tournament.teamRoundResults.push({
    gamePoints: gamePoints802,
    matchPoints: matchPoints802,
    nickname: nickname802,
    results: results802,
    tag: '802',
    teamId: teamId802,
  });

  break;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test src/__tests__/index.spec.ts` Expected: PASS

- [ ] **Step 6: Run lint**

Run: `pnpm run lint` Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/parse.ts src/__tests__/index.spec.ts
git commit -m "feat: parse 802 team round-by-round results"
```

---

### Task 3: Parse tag 801

**Files:**

- Modify: `src/parse.ts`
- Modify: `src/__tests__/index.spec.ts`

801 column layout (0-indexed):

- 0-2: tag `801`
- 3-6: team pairing number (4 chars, right-aligned — note: narrower than 802)
- 7-11: team nickname (5 chars)
- 12-15: total match points (4 chars)
- 16-21: total game points (6 chars)
- 22+: repeating 16-char blocks per round

Each 16-char round block:

- 0-4: opponent area (right-aligned id or spaces for byes)
- 5: color (`w`/`b` or space for bye)
- 7-15: raw result data (e.g. `=0=1 1234` or `FFFF      ` for byes)

For byes, the entire block contains bye marker: `FFFF` (FPB), `HHHH` (HPB),
`ZZZZ` (ZPB) centered.

- [ ] **Step 1: Write failing tests for 801 parsing**

Add to `src/__tests__/index.spec.ts`:

```typescript
describe('parse — team round results (801)', () => {
  it('parses 801 records from grandmommyscup fixture', () => {
    const result = parse(fixture('grandmommyscup'));
    const records801 = result?.teamRoundResults?.filter((r) => r.tag === '801');
    expect(records801).toBeDefined();
    expect(records801!.length).toBeGreaterThan(0);

    // Team 1 (IND): 14 rounds
    const team1 = records801!.find((r) => r.teamId === 1);
    expect(team1).toBeDefined();
    expect(team1!.matchPoints).toBe(15);
    expect(team1!.gamePoints).toBe(28);
    expect(team1!.nickname).toBe('IND');
    expect(team1!.results).toHaveLength(14);

    const r1 = team1!.results[0] as TeamRoundResult801;
    expect(r1.round).toBe(1);
    expect(r1.opponentId).toBe(14);
    expect(r1.raw).toBe('b =0=1 1234');
    expect(r1.type).toBeUndefined();
  });

  it('parses 801 bye types', () => {
    const result = parse(fixture('grandmommyscup'));
    const records801 = result?.teamRoundResults?.filter((r) => r.tag === '801');

    // Team 3 (GEO): round 1 is FPB (FFFF)
    const team3 = records801!.find((r) => r.teamId === 3);
    const round1 = team3!.results[0] as TeamRoundResult801;
    expect(round1.type).toBe('FPB');
    expect(round1.opponentId).toBeNull();

    // Team 7 (USA): round 2 is HPB (HHHH), round 9 is ZPB (ZZZZ)
    const team7 = records801!.find((r) => r.teamId === 7);
    const round2 = team7!.results[1] as TeamRoundResult801;
    expect(round2.type).toBe('HPB');
    expect(round2.opponentId).toBeNull();

    const round9 = team7!.results[8] as TeamRoundResult801;
    expect(round9.type).toBe('ZPB');
    expect(round9.opponentId).toBeNull();
  });

  it('parses 801 from inline input', () => {
    const input =
      '### trf26\n012 T\nXXR 3\n' +
      '801  1 AAA    5   10.0  14 b =0=1 1234  13 w ==== 1234       ZZZZ        \n';
    const result = parse(input);
    const rec = result?.teamRoundResults?.[0];
    expect(rec).toBeDefined();
    expect(rec!.tag).toBe('801');
    expect(rec!.teamId).toBe(1);
    expect(rec!.results).toHaveLength(3);

    const r1 = rec!.results[0] as TeamRoundResult801;
    expect(r1.opponentId).toBe(14);
    expect(r1.raw).toBe('b =0=1 1234');

    const r3 = rec!.results[2] as TeamRoundResult801;
    expect(r3.type).toBe('ZPB');
    expect(r3.opponentId).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/__tests__/index.spec.ts` Expected: FAIL — 801 records
not parsed

- [ ] **Step 3: Add import for `TeamRoundResult801` in `src/parse.ts`**

Add `TeamRoundResult801` to the existing import:

```typescript
import type {
  AbnormalPoints,
  NationalRating,
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  PlayerAcceleration,
  ResultCode,
  RoundResult,
  ScoringSystem,
  Sex,
  Team,
  TeamRoundResult801,
  TeamRoundResult802,
  Title,
  Tournament,
  Version,
} from './types.js';
```

- [ ] **Step 4: Add `case '801'` to the parser switch**

Insert before `case '802'`:

```typescript
case '801': {
  const BYE_MAP_801: Record<string, 'FPB' | 'HPB' | 'PAB' | 'ZPB'> = {
    FFFF: 'FPB',
    HHHH: 'HPB',
    PPPP: 'PAB',
    ZZZZ: 'ZPB',
  };

  const teamId801 = Number(line.slice(3, 7).trim()) || 0;
  if (teamId801 === 0) break;

  const nickname801 = line.slice(7, 12).trim() || undefined;
  const matchPoints801 = Number(line.slice(12, 16).trim()) || 0;
  const gamePoints801 = Number(line.slice(16, 22).trim()) || 0;

  const results801: TeamRoundResult801[] = [];
  let round801 = 1;
  for (let pos = 22; pos < line.length; pos += 16) {
    const block = line.slice(pos, pos + 16);
    if (block.trim().length === 0) break;

    // Check for bye marker (FFFF, HHHH, ZZZZ anywhere in block)
    const blockTrimmed = block.trim();
    const byeType = BYE_MAP_801[blockTrimmed];
    if (byeType !== undefined) {
      results801.push({
        // eslint-disable-next-line unicorn/no-null
        opponentId: null,
        raw: blockTrimmed,
        round: round801,
        type: byeType,
      });
    } else {
      // Normal round: opponent in first ~4 chars, rest is raw
      const oppRaw = block.slice(0, 5).trim();
      const opponentId = Number(oppRaw) || null; // eslint-disable-line unicorn/no-null
      const raw = block.slice(5).trimEnd();

      results801.push({
        opponentId,
        raw,
        round: round801,
      });
    }

    round801 += 1;
  }

  tournament.teamRoundResults ??= [];
  tournament.teamRoundResults.push({
    gamePoints: gamePoints801,
    matchPoints: matchPoints801,
    nickname: nickname801,
    results: results801,
    tag: '801',
    teamId: teamId801,
  });

  break;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test src/__tests__/index.spec.ts` Expected: PASS

- [ ] **Step 6: Run lint**

Run: `pnpm run lint` Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/parse.ts src/__tests__/index.spec.ts
git commit -m "feat: parse 801 team round-by-round results"
```

---

### Task 4: Stringify tags 801 and 802

**Files:**

- Modify: `src/stringify.ts`
- Modify: `src/__tests__/index.spec.ts`

- [ ] **Step 1: Write failing tests for 802 stringify**

Add to `src/__tests__/index.spec.ts`:

```typescript
describe('stringify — team round results (802)', () => {
  it('emits 802 tag for TRF26', () => {
    const t: Tournament = {
      players: [],
      rounds: 3,
      teamRoundResults: [
        {
          gamePoints: 8,
          matchPoints: 5,
          nickname: 'AAA',
          results: [
            { color: 'w', gamePoints: 2, opponentId: 2, round: 1 },
            { color: 'b', gamePoints: 1.5, opponentId: 3, round: 2 },
            { gamePoints: 4, opponentId: null, round: 3, type: 'FPB' },
          ] as TeamRoundResult802[],
          tag: '802',
          teamId: 1,
          version: 'TRF26',
        },
      ],
      version: 'TRF26',
    };
    const output = stringify(t);
    expect(output).toMatch(/^802/m);
    expect(output).toContain('802');
  });

  it('does not emit 802 for TRF16', () => {
    const t: Tournament = {
      players: [],
      rounds: 3,
      teamRoundResults: [
        {
          gamePoints: 8,
          matchPoints: 5,
          results: [
            { color: 'w', gamePoints: 2, opponentId: 2, round: 1 },
          ] as TeamRoundResult802[],
          tag: '802',
          teamId: 1,
        },
      ],
      version: 'TRF16',
    };
    const output = stringify(t);
    expect(output).not.toMatch(/^802/m);
  });

  it('emits 802 forfeit indicator', () => {
    const t: Tournament = {
      players: [],
      rounds: 1,
      teamRoundResults: [
        {
          gamePoints: 0,
          matchPoints: 0,
          results: [
            {
              color: 'b',
              forfeit: true,
              gamePoints: 0,
              opponentId: 2,
              round: 1,
            },
          ] as TeamRoundResult802[],
          tag: '802',
          teamId: 1,
        },
      ],
      version: 'TRF26',
    };
    const output = stringify(t);
    expect(output).toMatch(/0\.0f/);
  });
});
```

- [ ] **Step 2: Write failing tests for 801 stringify**

```typescript
describe('stringify — team round results (801)', () => {
  it('emits 801 tag for TRF26', () => {
    const t: Tournament = {
      players: [],
      rounds: 2,
      teamRoundResults: [
        {
          gamePoints: 4,
          matchPoints: 2,
          nickname: 'AAA',
          results: [
            { opponentId: 14, raw: 'b =0=1 1234', round: 1 },
            { opponentId: null, raw: 'ZZZZ', round: 2, type: 'ZPB' },
          ] as TeamRoundResult801[],
          tag: '801',
          teamId: 1,
        },
      ],
      version: 'TRF26',
    };
    const output = stringify(t);
    expect(output).toMatch(/^801/m);
  });

  it('does not emit 801 for TRF16', () => {
    const t: Tournament = {
      players: [],
      rounds: 1,
      teamRoundResults: [
        {
          gamePoints: 2,
          matchPoints: 1,
          results: [
            { opponentId: 14, raw: 'b =0=1 1234', round: 1 },
          ] as TeamRoundResult801[],
          tag: '801',
          teamId: 1,
        },
      ],
      version: 'TRF16',
    };
    const output = stringify(t);
    expect(output).not.toMatch(/^801/m);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm run test src/__tests__/index.spec.ts` Expected: FAIL — no 801/802 in
output

- [ ] **Step 4: Add stringify logic in `src/stringify.ts`**

After the team records (310) block (after line 498), add:

```typescript
// 801/802 — Team round-by-round results (TRF26 only)
if (tournament.version === 'TRF26') {
  for (const record of tournament.teamRoundResults ?? []) {
    if (record.tag === '801') {
      const buf801: string[] = Array.from({ length: 22 }, () => ' ');
      writeAt(buf801, 0, '801');
      writeAt(buf801, 3, pad(String(record.teamId), 4, 'right'));
      if (record.nickname !== undefined) {
        writeAt(buf801, 7, pad(record.nickname.slice(0, 5), 5, 'left'));
      }
      writeAt(buf801, 12, pad(String(record.matchPoints), 4, 'right'));
      writeAt(buf801, 16, pad(record.gamePoints.toFixed(1), 6, 'right'));
      for (const r of record.results as TeamRoundResult801[]) {
        const pos = 22 + (r.round - 1) * 16;
        while (buf801.length < pos + 16) {
          buf801.push(' ');
        }
        if (r.type !== undefined) {
          // Bye: write marker centered in block
          const BYE_MARKER_801: Record<string, string> = {
            FPB: 'FFFF',
            HPB: 'HHHH',
            PAB: 'PPPP',
            ZPB: 'ZZZZ',
          };
          const marker = BYE_MARKER_801[r.type] ?? 'ZZZZ';
          writeAt(buf801, pos + 5, `  ${marker}       `);
        } else {
          writeAt(
            buf801,
            pos,
            `  ${pad(String(r.opponentId ?? ''), 3, 'right')} ${r.raw}`,
          );
        }
      }
      lines.push(buf801.join('').trimEnd());
    } else {
      // 802
      const buf802: string[] = Array.from({ length: 28 }, () => ' ');
      writeAt(buf802, 0, '802');
      writeAt(buf802, 4, pad(String(record.teamId), 3, 'right'));
      if (record.nickname !== undefined) {
        writeAt(buf802, 8, pad(record.nickname.slice(0, 5), 5, 'left'));
      }
      writeAt(buf802, 14, pad(record.matchPoints.toFixed(1), 6, 'right'));
      writeAt(buf802, 21, pad(record.gamePoints.toFixed(1), 6, 'right'));
      for (const r of record.results as TeamRoundResult802[]) {
        const pos = 28 + (r.round - 1) * 13;
        while (buf802.length < pos + 13) {
          buf802.push(' ');
        }
        if (r.type !== undefined) {
          // Bye type
          writeAt(buf802, pos, r.type);
          writeAt(buf802, pos + 6, pad(r.gamePoints.toFixed(1), 4, 'right'));
        } else {
          writeAt(buf802, pos, pad(String(r.opponentId ?? ''), 3, 'right'));
          if (r.color !== undefined) {
            buf802[pos + 4] = r.color;
          }
          writeAt(buf802, pos + 6, pad(r.gamePoints.toFixed(1), 4, 'right'));
          if (r.forfeit === true) {
            buf802[pos + 10] = 'f';
          }
        }
      }
      lines.push(buf802.join('').trimEnd());
    }
  }
}
```

Add import for `TeamRoundResult801` and `TeamRoundResult802` at top of
`src/stringify.ts`:

```typescript
import type {
  Player,
  StringifyOptions,
  TeamRoundResult801,
  TeamRoundResult802,
  Tournament,
} from './types.js';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm run test src/__tests__/index.spec.ts` Expected: PASS

- [ ] **Step 6: Run lint**

Run: `pnpm run lint` Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/stringify.ts src/__tests__/index.spec.ts
git commit -m "feat: stringify 801/802 team round-by-round results"
```

---

### Task 5: Round-trip test and final verification

**Files:**

- Modify: `src/__tests__/index.spec.ts`

- [ ] **Step 1: Write round-trip test**

Add to `src/__tests__/index.spec.ts`:

```typescript
describe('round-trip — team round results (802)', () => {
  it('parse then stringify preserves 802 structured data', () => {
    const input =
      '### trf26\n012 T\nXXR 3\n' +
      '802   1 AAA      5      8.0   2 w  2.0     3 b  1.5   FPB    4.0 \n';
    const parsed = parse(input);
    expect(parsed).not.toBeNull();
    const output = stringify(parsed!);
    const reparsed = parse(output);
    expect(reparsed?.teamRoundResults).toHaveLength(1);
    const rec = reparsed!.teamRoundResults![0];
    expect(rec.tag).toBe('802');
    expect(rec.teamId).toBe(1);
    expect(rec.matchPoints).toBe(5);
    expect(rec.gamePoints).toBe(8);
    expect(rec.results).toHaveLength(3);

    const r3 = rec.results[2] as TeamRoundResult802;
    expect(r3.type).toBe('FPB');
    expect(r3.gamePoints).toBe(4);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm run test src/__tests__/index.spec.ts` Expected: PASS

- [ ] **Step 3: Run full verification**

Run: `pnpm lint && pnpm test && pnpm build` Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/index.spec.ts
git commit -m "test: add round-trip test for 802 team round results"
```
