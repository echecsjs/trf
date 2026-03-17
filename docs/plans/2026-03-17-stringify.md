# stringify() Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Add `stringify(tournament: Tournament): string` as a named export from
`@echecs/trf`, the inverse of `parse()`.

**Architecture:** Split current `src/index.ts` into `src/parse.ts` +
`src/stringify.ts`, with `src/index.ts` becoming a re-export barrel.
`stringify()` builds TRF lines by padding fields into fixed column offsets
mirroring the `COL_*` constants used by the parser.

**Tech Stack:** TypeScript, Vitest. No new dependencies.

---

## Task 1: Split `src/index.ts` into `src/parse.ts`

**Files:**

- Create: `src/parse.ts`
- Modify: `src/index.ts`

**Step 1: Create `src/parse.ts` by moving all logic from `src/index.ts`**

Copy all content from `src/index.ts` into `src/parse.ts`, then change the import
path for types from `'./types.js'` (unchanged) and change
`export default function parse` to remain the default export. The file should
look exactly like `src/index.ts` currently does.

`src/parse.ts` — full content (identical to current `src/index.ts`):

```ts
// (copy entire src/index.ts content verbatim)
```

**Step 2: Replace `src/index.ts` with a re-export barrel**

```ts
export { default as parse } from './parse.js';
export { default as stringify } from './stringify.js';

export type {
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  ResultCode,
  RoundResult,
  Sex,
  Title,
  Tournament,
  Version,
} from './types.js';
```

Note: `parse` is no longer the default export from the package — it becomes a
named export. This is a breaking change from v1.0.0. The `package.json` version
will be bumped in Task 5.

**Step 3: Create an empty `src/stringify.ts` stub so the barrel compiles**

```ts
import type { Tournament } from './types.js';

export default function stringify(_tournament: Tournament): string {
  return '';
}
```

**Step 4: Run the type-check to confirm the barrel compiles**

```bash
pnpm run lint:types
```

Expected: no errors.

**Step 5: Run the tests to confirm existing tests still pass**

```bash
pnpm run test
```

Expected: all tests pass. Note — `src/__tests__/index.spec.ts` imports `parse`
from `'../index.js'` as a default import. Update that import to a named import:

```ts
// before
import parse from '../index.js';
// after
import { parse } from '../index.js';
```

**Step 6: Commit**

```bash
git add src/parse.ts src/stringify.ts src/index.ts src/__tests__/index.spec.ts
git commit -m "refactor: split index.ts into parse.ts + stringify.ts barrel"
```

---

## Task 2: Write failing tests for `stringify()` — header tags

**Files:**

- Create: `src/__tests__/stringify.spec.ts`

**Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { stringify } from '../index.js';
import type { Tournament } from '../types.js';

function minimal(overrides: Partial<Tournament> = {}): Tournament {
  return { players: [], rounds: 0, version: 'TRF16', ...overrides };
}

describe('stringify — header tags', () => {
  it('emits XXR line for rounds', () => {
    expect(stringify(minimal({ rounds: 9 }))).toContain('XXR 9');
  });

  it('emits 012 line for name', () => {
    expect(stringify(minimal({ name: 'Open Championship' }))).toContain(
      '012 Open Championship',
    );
  });

  it('emits 022 line for city', () => {
    expect(stringify(minimal({ city: 'Paris' }))).toContain('022 Paris');
  });

  it('emits 032 line for federation', () => {
    expect(stringify(minimal({ federation: 'FRA' }))).toContain('032 FRA');
  });

  it('emits 042 line for startDate', () => {
    expect(stringify(minimal({ startDate: '2026-01-01' }))).toContain(
      '042 2026-01-01',
    );
  });

  it('emits 052 line for endDate', () => {
    expect(stringify(minimal({ endDate: '2026-01-07' }))).toContain(
      '052 2026-01-07',
    );
  });

  it('emits 092 line for chiefArbiter', () => {
    expect(stringify(minimal({ chiefArbiter: 'Smith John' }))).toContain(
      '092 Smith John',
    );
  });

  it('emits 112 line for timeControl', () => {
    expect(stringify(minimal({ timeControl: '90+30' }))).toContain('112 90+30');
  });

  it('omits 012 line when name is absent', () => {
    expect(stringify(minimal())).not.toContain('012');
  });

  it('omits XXR line when rounds is 0', () => {
    expect(stringify(minimal({ rounds: 0 }))).not.toContain('XXR');
  });
});
```

**Step 2: Run to confirm they fail**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: FAIL — `stringify` returns `''`.

**Step 3: Do not implement yet — move to Task 3.**

---

## Task 3: Implement `stringify()` — header tags

**Files:**

- Modify: `src/stringify.ts`

**Step 1: Implement header tag emission**

```ts
import type { Tournament } from './types.js';

export default function stringify(tournament: Tournament): string {
  const lines: string[] = [];

  if (tournament.name !== undefined) {
    lines.push(`012 ${tournament.name}`);
  }
  if (tournament.city !== undefined) {
    lines.push(`022 ${tournament.city}`);
  }
  if (tournament.federation !== undefined) {
    lines.push(`032 ${tournament.federation}`);
  }
  if (tournament.startDate !== undefined) {
    lines.push(`042 ${tournament.startDate}`);
  }
  if (tournament.endDate !== undefined) {
    lines.push(`052 ${tournament.endDate}`);
  }
  if (tournament.chiefArbiter !== undefined) {
    lines.push(`092 ${tournament.chiefArbiter}`);
  }
  if (tournament.timeControl !== undefined) {
    lines.push(`112 ${tournament.timeControl}`);
  }
  if (tournament.rounds > 0) {
    lines.push(`XXR ${tournament.rounds}`);
  }

  return lines.join('\n');
}
```

**Step 2: Run the header tests**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: header tag tests pass.

**Step 3: Run full test suite**

```bash
pnpm run test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add src/stringify.ts src/__tests__/stringify.spec.ts
git commit -m "feat: stringify() header tag emission"
```

---

## Task 4: Write failing tests for `stringify()` — player lines

**Files:**

- Modify: `src/__tests__/stringify.spec.ts`

**Step 1: Add player line tests**

```ts
import { describe, expect, it } from 'vitest';
import { parse, stringify } from '../index.js';
import type { Player, Tournament } from '../types.js';

// ... (keep existing helper and header tests)

function minimalPlayer(overrides: Partial<Player> = {}): Player {
  return {
    name: 'Test Player',
    pairingNumber: 1,
    points: 0,
    rank: 1,
    results: [],
    ...overrides,
  };
}

describe('stringify — player lines', () => {
  it('emits a 001 line for each player', () => {
    const t = minimal({
      players: [
        minimalPlayer(),
        minimalPlayer({ pairingNumber: 2, name: 'Other' }),
      ],
    });
    const lines = stringify(t)
      .split('\n')
      .filter((l) => l.startsWith('001'));
    expect(lines).toHaveLength(2);
  });

  it('writes pairing number right-aligned in cols 4-7', () => {
    const line = stringify(
      minimal({ players: [minimalPlayer({ pairingNumber: 1 })] }),
    )
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(4, 8)).toBe('   1');
  });

  it('writes sex at col 9', () => {
    const line = stringify(minimal({ players: [minimalPlayer({ sex: 'm' })] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line[9]).toBe('m');
  });

  it('writes blank at col 9 when sex is absent', () => {
    const line = stringify(minimal({ players: [minimalPlayer()] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line[9]).toBe(' ');
  });

  it('writes title left-aligned in cols 10-13', () => {
    const line = stringify(
      minimal({ players: [minimalPlayer({ title: 'GM' })] }),
    )
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(10, 14)).toBe('GM  ');
  });

  it('writes name left-aligned starting at col 14', () => {
    const line = stringify(
      minimal({ players: [minimalPlayer({ name: 'Kasparov, Garry' })] }),
    )
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(14, 47).trimEnd()).toBe('Kasparov, Garry');
  });

  it('writes rating right-aligned in cols 48-51', () => {
    const line = stringify(
      minimal({ players: [minimalPlayer({ rating: 2851 })] }),
    )
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(48, 52)).toBe('2851');
  });

  it('writes blank rating when absent', () => {
    const line = stringify(minimal({ players: [minimalPlayer()] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(48, 52).trim()).toBe('');
  });

  it('writes federation left-aligned in cols 53-55', () => {
    const line = stringify(
      minimal({ players: [minimalPlayer({ federation: 'RUS' })] }),
    )
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(53, 56)).toBe('RUS');
  });

  it('writes fideId left-aligned in cols 57-67', () => {
    const line = stringify(
      minimal({ players: [minimalPlayer({ fideId: '4100018363' })] }),
    )
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(57, 68).trimEnd()).toBe('4100018363');
  });

  it('writes birthDate left-aligned in cols 70-79', () => {
    const line = stringify(
      minimal({ players: [minimalPlayer({ birthDate: '1963-04-13' })] }),
    )
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(70, 80)).toBe('1963-04-13');
  });

  it('writes points right-aligned in cols 80-83 with one decimal', () => {
    const line = stringify(
      minimal({ players: [minimalPlayer({ points: 4.5 })] }),
    )
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(80, 84)).toBe(' 4.5');
  });

  it('writes integer points with .0 suffix', () => {
    const line = stringify(minimal({ players: [minimalPlayer({ points: 3 })] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(80, 84)).toBe(' 3.0');
  });

  it('writes rank right-aligned in cols 84-88', () => {
    const line = stringify(minimal({ players: [minimalPlayer({ rank: 7 })] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(84, 89)).toBe('    7');
  });
});

describe('stringify — round results', () => {
  it('writes round result at col 91 for first round', () => {
    const player = minimalPlayer({
      results: [{ color: 'w', opponentId: 2, result: '1', round: 1 }],
    });
    const line = stringify(minimal({ players: [player] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    // "  2 w 1  " — 4-char opponent, space, color, space, result, 2 spaces
    expect(line.slice(91, 101)).toBe('   2 w 1  ');
  });

  it('writes 0000 for null opponentId (bye)', () => {
    const player = minimalPlayer({
      results: [{ color: 'b', opponentId: null, result: 'Z', round: 1 }],
    });
    const line = stringify(minimal({ players: [player] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(91, 101)).toBe('0000 b Z  ');
  });

  it('writes second round result at col 101', () => {
    const player = minimalPlayer({
      results: [
        { color: 'w', opponentId: 2, result: '1', round: 1 },
        { color: 'b', opponentId: 3, result: '0', round: 2 },
      ],
    });
    const line = stringify(minimal({ players: [player] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(101, 111)).toBe('   3 b 0  ');
  });

  it('writes no round columns when results is empty', () => {
    const line = stringify(minimal({ players: [minimalPlayer()] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.length).toBe(89); // ends after rank column
  });
});
```

**Step 2: Run to confirm they fail**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: player line tests FAIL.

---

## Task 5: Implement `stringify()` — player lines

**Files:**

- Modify: `src/stringify.ts`

**Step 1: Add the column constants and `stringifyPlayerLine` helper**

```ts
import type { Player, Tournament } from './types.js';

// Mirror the COL_* constants from parse.ts
const COL_PAIRING_NUMBER = 4;
const COL_SEX = 9;
const COL_TITLE = 10;
const COL_NAME = 14;
const COL_RATING = 48;
const COL_FEDERATION = 53;
const COL_FIDE_ID = 57;
const COL_BIRTH_DATE = 70;
const COL_POINTS = 80;
const COL_RANK = 84;
const ROUND_RESULTS_OFFSET = 91;
const ROUND_ENTRY_LENGTH = 10;

function pad(value: string, length: number, align: 'left' | 'right'): string {
  return align === 'right' ? value.padStart(length) : value.padEnd(length);
}

function writeAt(buf: string[], col: number, value: string): void {
  for (let i = 0; i < value.length; i++) {
    buf[col + i] = value[i] ?? ' ';
  }
}

function stringifyPlayerLine(player: Player): string {
  // Build a character buffer pre-filled with spaces up to rank column end
  const buf: string[] = Array.from({ length: COL_RANK + 5 }, () => ' ');

  // Record type
  buf[0] = '0';
  buf[1] = '0';
  buf[2] = '1';

  // Pairing number — right-aligned in 4 chars at col 4
  writeAt(
    buf,
    COL_PAIRING_NUMBER,
    pad(String(player.pairingNumber), 4, 'right'),
  );

  // Sex — single char at col 9
  if (player.sex !== undefined) {
    buf[COL_SEX] = player.sex;
  }

  // Title — left-aligned in 4 chars at col 10
  if (player.title !== undefined) {
    writeAt(buf, COL_TITLE, pad(player.title, 4, 'left'));
  }

  // Name — left-aligned in 33 chars at col 14
  writeAt(buf, COL_NAME, pad(player.name.slice(0, 33), 33, 'left'));

  // Rating — right-aligned in 4 chars at col 48
  if (player.rating !== undefined) {
    writeAt(buf, COL_RATING, pad(String(player.rating), 4, 'right'));
  }

  // Federation — left-aligned in 3 chars at col 53
  if (player.federation !== undefined) {
    writeAt(buf, COL_FEDERATION, pad(player.federation.slice(0, 3), 3, 'left'));
  }

  // FIDE ID — left-aligned in 11 chars at col 57
  if (player.fideId !== undefined) {
    writeAt(buf, COL_FIDE_ID, pad(player.fideId.slice(0, 11), 11, 'left'));
  }

  // Birth date — left-aligned in 10 chars at col 70
  if (player.birthDate !== undefined) {
    writeAt(
      buf,
      COL_BIRTH_DATE,
      pad(player.birthDate.slice(0, 10), 10, 'left'),
    );
  }

  // Points — right-aligned in 4 chars at col 80, always one decimal place
  const pointsStr = player.points.toFixed(1);
  writeAt(buf, COL_POINTS, pad(pointsStr, 4, 'right'));

  // Rank — right-aligned in 5 chars at col 84
  writeAt(buf, COL_RANK, pad(String(player.rank), 5, 'right'));

  // Round results — each 10 chars starting at col 91
  if (player.results.length > 0) {
    for (const result of player.results) {
      const slot =
        ROUND_RESULTS_OFFSET + (result.round - 1) * ROUND_ENTRY_LENGTH;
      // Extend buffer if needed
      while (buf.length < slot + ROUND_ENTRY_LENGTH) {
        buf.push(' ');
      }
      const opponentStr =
        result.opponentId === null
          ? '0000'
          : String(result.opponentId).padStart(4, ' ');
      const entry = `${opponentStr} ${result.color} ${result.result}  `;
      writeAt(buf, slot, entry);
    }
  }

  return buf.join('').trimEnd();
}

export default function stringify(tournament: Tournament): string {
  const lines: string[] = [];

  if (tournament.name !== undefined) lines.push(`012 ${tournament.name}`);
  if (tournament.city !== undefined) lines.push(`022 ${tournament.city}`);
  if (tournament.federation !== undefined)
    lines.push(`032 ${tournament.federation}`);
  if (tournament.startDate !== undefined)
    lines.push(`042 ${tournament.startDate}`);
  if (tournament.endDate !== undefined) lines.push(`052 ${tournament.endDate}`);
  if (tournament.chiefArbiter !== undefined)
    lines.push(`092 ${tournament.chiefArbiter}`);
  if (tournament.timeControl !== undefined)
    lines.push(`112 ${tournament.timeControl}`);
  if (tournament.rounds > 0) lines.push(`XXR ${tournament.rounds}`);

  for (const player of tournament.players) {
    lines.push(stringifyPlayerLine(player));
  }

  return lines.join('\n');
}
```

**Step 2: Run player line tests**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: all tests pass.

**Step 3: Run full test suite**

```bash
pnpm run test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add src/stringify.ts src/__tests__/stringify.spec.ts
git commit -m "feat: stringify() player line emission"
```

---

## Task 6: Write and run roundtrip tests

**Files:**

- Modify: `src/__tests__/stringify.spec.ts`

**Step 1: Add roundtrip tests using existing fixtures**

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';

function fixture(name: string): string {
  return readFileSync(
    path.join(import.meta.dirname, 'fixtures', `${name}.trf`),
    'utf8',
  );
}

const ROUNDTRIP_FIXTURES = [
  'dutch_2025_C5',
  'dutch_2025_C9',
  'issue_7',
  'issue_15',
  'javafo_sample2',
];

describe('stringify — roundtrip', () => {
  for (const name of ROUNDTRIP_FIXTURES) {
    it(`parse → stringify → parse is stable for ${name}`, () => {
      const t1 = parse(fixture(name))!;
      const t2 = parse(stringify(t1))!;
      expect(t2).not.toBeNull();
      expect(t2.name).toBe(t1.name);
      expect(t2.rounds).toBe(t1.rounds);
      expect(t2.players).toHaveLength(t1.players.length);
      for (const [i, p1] of t1.players.entries()) {
        const p2 = t2.players[i]!;
        expect(p2.pairingNumber).toBe(p1.pairingNumber);
        expect(p2.name).toBe(p1.name);
        expect(p2.rating).toBe(p1.rating);
        expect(p2.points).toBe(p1.points);
        expect(p2.rank).toBe(p1.rank);
        expect(p2.results).toHaveLength(p1.results.length);
        for (const [j, r1] of p1.results.entries()) {
          const r2 = p2.results[j]!;
          expect(r2.round).toBe(r1.round);
          expect(r2.color).toBe(r1.color);
          expect(r2.result).toBe(r1.result);
          expect(r2.opponentId).toBe(r1.opponentId);
        }
      }
    });
  }
});
```

**Step 2: Run roundtrip tests**

```bash
pnpm run test src/__tests__/stringify.spec.ts
```

Expected: all roundtrip tests pass. If any fail, debug the column offsets in
`stringifyPlayerLine`.

**Step 3: Run full test suite**

```bash
pnpm run test
```

Expected: all tests pass.

**Step 4: Commit**

```bash
git add src/__tests__/stringify.spec.ts
git commit -m "test: roundtrip tests for stringify()"
```

---

## Task 7: Lint, build, and version bump

**Files:**

- Modify: `package.json`
- Modify: `CHANGELOG.md`

**Step 1: Run lint**

```bash
pnpm run lint
```

Fix any ESLint or TypeScript errors before continuing. Common issues:

- `sort-keys` — all interface fields must be alphabetically sorted (already
  satisfied since we're not adding new types)
- unused imports
- `.js` extensions on relative imports (already used throughout)

**Step 2: Run build**

```bash
pnpm run build
```

Expected: `dist/` updated, no errors.

**Step 3: Verify exports are present in build**

```bash
node -e "import('@echecs/trf').then(m => console.log(Object.keys(m)))"
```

Expected output includes `parse` and `stringify`.

**Step 4: Bump version to 2.0.0 in `package.json`**

This is a breaking change: `parse` was the default export in v1.0.0 and is now a
named export.

```json
"version": "2.0.0"
```

**Step 5: Update `CHANGELOG.md`**

Add an entry at the top:

```markdown
## [2.0.0] - 2026-03-17

### Breaking Changes

- `parse` is no longer the default export. Use
  `import { parse } from '@echecs/trf'`.

### Added

- `stringify(tournament: Tournament): string` — serializes a `Tournament` to
  TRF16 format.

### Changed

- `src/index.ts` is now a re-export barrel; logic lives in `src/parse.ts` and
  `src/stringify.ts`.
```

**Step 6: Final full check**

```bash
pnpm run lint && pnpm run test && pnpm run build
```

Expected: all pass, zero warnings.

**Step 7: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump to 2.0.0, add stringify to CHANGELOG"
```
