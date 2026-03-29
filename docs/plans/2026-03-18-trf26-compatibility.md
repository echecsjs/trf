# TRF16 + TRF26 Compatibility Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Extend the parser and stringifier to fully support TRF26 while
remaining backward-compatible with TRF16 files.

**Architecture:** Additive types — `Tournament` gains optional TRF26 fields;
`version` is auto-detected from the input. The `001` column layout is identical
between versions. Stringify emits TRF26-only records only when
`version === 'TRF26'`. Three pre-existing tag mapping bugs (`092`, `102`, `112`,
`122`) are fixed as part of this work.

**Tech Stack:** TypeScript (NodeNext), Vitest, ESLint (`sort-keys` rule on all
interfaces)

---

## Task 1: Fix tag mapping bugs + store previously-silenced tags

The current code maps `092` → `chiefArbiter`, `112` → `timeControl`. Both are
wrong per spec. This task fixes the mappings and stores `062`, `072`, `082`
which were previously ignored.

**Files:**

- Modify: `src/types.ts`
- Modify: `src/parse.ts`
- Modify: `src/stringify.ts`
- Modify: `src/__tests__/index.spec.ts`

**Step 1: Write failing tests**

In `src/__tests__/index.spec.ts`, replace the two existing tag tests that use
the wrong mappings and add new ones:

```ts
// In describe('parse — header tags')
it('parses type of tournament from 092 tag', () => {
  expect(parse('012 T\n092 Swiss\nXXR 1\n')?.tournamentType).toBe('Swiss');
});

it('parses chief arbiter from 102 tag', () => {
  expect(parse('012 T\n102 Smith John\nXXR 1\n')?.chiefArbiter).toBe(
    'Smith John',
  );
});

it('parses deputy arbiters from 112 tag', () => {
  expect(
    parse('012 T\n112 Doe Jane\n112 Doe Jim\nXXR 1\n')?.deputyArbiters,
  ).toEqual(['Doe Jane', 'Doe Jim']);
});

it('parses time control from 122 tag', () => {
  expect(parse('012 T\n122 90+30\nXXR 1\n')?.timeControl).toBe('90+30');
});

it('parses number of players from 062 tag', () => {
  expect(parse('012 T\n062 100\nXXR 1\n')?.numberOfPlayers).toBe(100);
});

it('parses number of rated players from 072 tag', () => {
  expect(parse('012 T\n072 80\nXXR 1\n')?.numberOfRatedPlayers).toBe(80);
});

it('parses number of teams from 082 tag', () => {
  expect(parse('012 T\n082 10\nXXR 1\n')?.numberOfTeams).toBe(10);
});
```

Also add stringify tests:

```ts
// In describe('stringify — header tags') or equivalent
it('stringifies tournamentType as 092', () => {
  const t = {
    players: [],
    rounds: 1,
    tournamentType: 'Swiss',
    version: 'TRF16',
  } as Tournament;
  expect(stringify(t)).toContain('092 Swiss');
});

it('stringifies chiefArbiter as 102', () => {
  const t = {
    chiefArbiter: 'Smith',
    players: [],
    rounds: 1,
    version: 'TRF16',
  } as Tournament;
  expect(stringify(t)).toContain('102 Smith');
});

it('stringifies each deputyArbiter as 112', () => {
  const t = {
    deputyArbiters: ['A', 'B'],
    players: [],
    rounds: 1,
    version: 'TRF16',
  } as Tournament;
  const out = stringify(t);
  expect(out).toContain('112 A');
  expect(out).toContain('112 B');
});

it('stringifies timeControl as 122', () => {
  const t = {
    players: [],
    rounds: 1,
    timeControl: '90+30',
    version: 'TRF16',
  } as Tournament;
  expect(stringify(t)).toContain('122 90+30');
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm test
```

Expected: new tests FAIL, existing `chiefArbiter`/`timeControl` tag tests may
also fail once types change.

**Step 3: Update `src/types.ts`**

Add new fields to `Tournament` (keep all fields sorted alphabetically):

```ts
interface Tournament {
  chiefArbiter?: string; // 102
  city?: string; // 022
  deputyArbiters?: string[]; // 112 — multiple lines allowed
  endDate?: string; // 052
  federation?: string; // 032
  name?: string; // 012
  numberOfPlayers?: number; // 062
  numberOfRatedPlayers?: number; // 072
  numberOfTeams?: number; // 082
  players: Player[];
  rounds: number; // XXR
  startDate?: string; // 042
  timeControl?: string; // 122
  tournamentType?: string; // 092
  version: Version;
}
```

**Step 4: Update `src/parse.ts`**

Fix the switch cases:

```ts
case '062': {
  tournament.numberOfPlayers = Number(line.slice(4).trim()) || undefined;
  break;
}
case '072': {
  tournament.numberOfRatedPlayers = Number(line.slice(4).trim()) || undefined;
  break;
}
case '082': {
  tournament.numberOfTeams = Number(line.slice(4).trim()) || undefined;
  break;
}
case '092': {
  tournament.tournamentType = line.slice(4).trim();
  break;
}
case '102': {
  tournament.chiefArbiter = line.slice(4).trim();
  break;
}
case '112': {
  tournament.deputyArbiters ??= [];
  tournament.deputyArbiters.push(line.slice(4).trim());
  break;
}
case '122': {
  tournament.timeControl = line.slice(4).trim();
  break;
}
```

Remove `'062'`, `'072'`, `'082'`, `'102'`, `'112'`, `'122'` from
`KNOWN_HEADER_TAGS` (they now have explicit cases).

**Step 5: Update `src/stringify.ts`**

Replace the old `092`/`112` emits:

```ts
if (tournament.tournamentType !== undefined) {
  lines.push(`092 ${tournament.tournamentType}`);
}
if (tournament.numberOfPlayers !== undefined) {
  lines.push(`062 ${tournament.numberOfPlayers}`);
}
if (tournament.numberOfRatedPlayers !== undefined) {
  lines.push(`072 ${tournament.numberOfRatedPlayers}`);
}
if (tournament.numberOfTeams !== undefined) {
  lines.push(`082 ${tournament.numberOfTeams}`);
}
if (tournament.chiefArbiter !== undefined) {
  lines.push(`102 ${tournament.chiefArbiter}`);
}
for (const arbiter of tournament.deputyArbiters ?? []) {
  lines.push(`112 ${arbiter}`);
}
if (tournament.timeControl !== undefined) {
  lines.push(`122 ${tournament.timeControl}`);
}
```

**Step 6: Run tests**

```bash
pnpm test
```

Expected: all new tests PASS. Update any existing tests that checked
`chiefArbiter` from `092` or `timeControl` from `112` to use the correct tags.

**Step 7: Lint and type-check**

```bash
pnpm lint
```

**Step 8: Commit**

```bash
git add src/types.ts src/parse.ts src/stringify.ts src/__tests__/index.spec.ts
git commit -m "fix: correct tag mappings for 092/102/112/122 and store 062/072/082"
```

---

## Task 2: Version detection + comment lines

**Files:**

- Modify: `src/parse.ts`
- Modify: `src/types.ts`
- Modify: `src/__tests__/index.spec.ts`

**Step 1: Write failing tests**

```ts
describe('parse — version detection', () => {
  it('returns TRF16 for standard TRF16 input', () => {
    expect(parse('012 T\nXXR 1\n')?.version).toBe('TRF16');
  });

  it('returns TRF26 when ### comment line is present', () => {
    expect(parse('### comment\n012 T\nXXR 1\n')?.version).toBe('TRF26');
  });

  it('returns TRF26 when 142 tag is present', () => {
    expect(parse('012 T\n142 9\n')?.version).toBe('TRF26');
  });

  it('returns TRF26 when 310 record is present', () => {
    expect(parse('012 T\nXXR 1\n310   1 India\n')?.version).toBe('TRF26');
  });
});

describe('parse — comment lines', () => {
  it('collects ### comment lines', () => {
    const result = parse('### first comment\n### second\n012 T\nXXR 1\n');
    expect(result?.comments).toEqual(['first comment', 'second']);
  });

  it('ignores ### lines for version TRF16 files (no comments field)', () => {
    expect(parse('012 T\nXXR 1\n')?.comments).toBeUndefined();
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm test
```

**Step 3: Update `src/types.ts`**

Add `comments` to `Tournament`:

```ts
comments?: string[];  // ### lines — TRF26 only
```

**Step 4: Update `src/parse.ts`**

Replace `detectVersion()` with a pre-scan:

```ts
const TRF26_TAGS = new Set([
  '###',
  '142',
  '152',
  '162',
  '172',
  '182',
  '192',
  '202',
  '212',
  '222',
  '250',
  '260',
  '299',
  '300',
  '310',
  '320',
  '330',
  '352',
  '362',
  '801',
  '802',
]);

function detectVersion(lines: string[]): Version {
  for (const line of lines) {
    const tag = line.slice(0, 3);
    if (TRF26_TAGS.has(tag)) return 'TRF26';
    // NRS record: 3 uppercase letters not in known tags
    if (/^[A-Z]{3}$/.test(tag) && !KNOWN_HEADER_TAGS.has(tag)) return 'TRF26';
  }
  return 'TRF16';
}
```

Call it before the main loop:

```ts
const lines = content.split('\n');
const version = detectVersion(lines);
```

Add `###` handling in the switch:

```ts
case '###': {
  tournament.comments ??= [];
  tournament.comments.push(line.slice(4));
  break;
}
```

Add `'###'`, `'142'`, `'152'`, `'162'`, `'172'`, `'182'`, `'192'`, `'202'`,
`'212'`, `'222'`, `'250'`, `'260'`, `'299'`, `'300'`, `'310'`, `'320'`, `'330'`,
`'352'`, `'362'`, `'801'`, `'802'` to `KNOWN_HEADER_TAGS` temporarily (they'll
get real cases in later tasks).

**Step 5: Run tests**

```bash
pnpm test
```

**Step 6: Lint**

```bash
pnpm lint
```

**Step 7: Commit**

```bash
git add src/types.ts src/parse.ts src/__tests__/index.spec.ts
git commit -m "feat: detect TRF26 version and collect comment lines"
```

---

## Task 3: New simple TRF26 tags (152, 142, 182) + stringify comments

**Files:**

- Modify: `src/types.ts`
- Modify: `src/parse.ts`
- Modify: `src/stringify.ts`
- Modify: `src/__tests__/index.spec.ts`

**Step 1: Write failing tests**

```ts
describe('parse — TRF26 tags', () => {
  it('parses initialColour from 152 tag', () => {
    expect(parse('### trf26\n012 T\n152 W\nXXR 1\n')?.initialColour).toBe('W');
  });

  it('parses rounds from 142 tag', () => {
    expect(parse('### trf26\n012 T\n142 11\n')?.rounds).toBe(11);
  });

  it('parses pairingController from 182 tag', () => {
    expect(
      parse('### trf26\n012 T\n182 bbpPairings\nXXR 1\n')?.pairingController,
    ).toBe('bbpPairings');
  });
});

describe('stringify — TRF26 features', () => {
  it('emits ### comments before other tags when version is TRF26', () => {
    const t = {
      comments: ['hello'],
      name: 'T',
      players: [],
      rounds: 1,
      version: 'TRF26',
    } as Tournament;
    const lines = stringify(t).split('\n');
    expect(lines[0]).toBe('### hello');
    expect(lines[1]).toBe('012 T');
  });

  it('emits 142 in addition to XXR when version is TRF26', () => {
    const t = { players: [], rounds: 9, version: 'TRF26' } as Tournament;
    const out = stringify(t);
    expect(out).toContain('142 9');
    expect(out).toContain('XXR 9');
  });

  it('does not emit 142 for TRF16', () => {
    const t = { players: [], rounds: 9, version: 'TRF16' } as Tournament;
    expect(stringify(t)).not.toContain('142');
  });

  it('emits 152 initialColour when version is TRF26', () => {
    const t = {
      initialColour: 'W',
      players: [],
      rounds: 1,
      version: 'TRF26',
    } as Tournament;
    expect(stringify(t)).toContain('152 W');
  });

  it('emits 182 pairingController when version is TRF26', () => {
    const t = {
      pairingController: 'bbpPairings',
      players: [],
      rounds: 1,
      version: 'TRF26',
    } as Tournament;
    expect(stringify(t)).toContain('182 bbpPairings');
  });
});
```

**Step 2: Run to confirm they fail**

```bash
pnpm test
```

**Step 3: Update `src/types.ts`**

```ts
interface Tournament {
  // ... existing fields ...
  initialColour?: 'B' | 'W'; // 152 — TRF26
  pairingController?: string; // 182 — TRF26
}
```

**Step 4: Update `src/parse.ts`**

```ts
case '142': {
  tournament.rounds = Number(line.slice(4).trim()) || 0;
  break;
}
case '152': {
  const c = line.slice(4).trim();
  if (c === 'W' || c === 'B') tournament.initialColour = c;
  break;
}
case '182': {
  tournament.pairingController = line.slice(4).trim();
  break;
}
```

Remove `'142'`, `'152'`, `'182'` from `KNOWN_HEADER_TAGS`.

**Step 5: Update `src/stringify.ts`**

At the top of `stringify()`, emit comments first:

```ts
for (const comment of tournament.comments ?? []) {
  lines.push(`### ${comment}`);
}
```

After `XXR`:

```ts
if (tournament.rounds > 0 && tournament.version === 'TRF26') {
  lines.push(`142 ${tournament.rounds}`);
}
if (tournament.initialColour !== undefined && tournament.version === 'TRF26') {
  lines.push(`152 ${tournament.initialColour}`);
}
if (
  tournament.pairingController !== undefined &&
  tournament.version === 'TRF26'
) {
  lines.push(`182 ${tournament.pairingController}`);
}
```

**Step 6: Run tests**

```bash
pnpm test
```

**Step 7: Lint**

```bash
pnpm lint
```

**Step 8: Commit**

```bash
git add src/types.ts src/parse.ts src/stringify.ts src/__tests__/index.spec.ts
git commit -m "feat: parse and stringify TRF26 tags 142/152/182 and comment lines"
```

---

## Task 4: New result codes W, D, L

**Files:**

- Modify: `src/types.ts`
- Modify: `src/parse.ts`
- Modify: `src/__tests__/index.spec.ts`

**Step 1: Write failing tests**

```ts
describe('parse — TRF26 result codes', () => {
  function lineWithResult(result: string): string {
    return `001    1      Test Player                      2000             1.0    1      2 w ${result}`;
  }

  it('parses W result code (unrated win)', () => {
    const input = `### trf26\n012 T\nXXR 1\n${lineWithResult('W')}\n`;
    expect(parse(input)?.players[0]?.results[0]?.result).toBe('W');
  });

  it('parses D result code (unrated draw)', () => {
    const input = `### trf26\n012 T\nXXR 1\n${lineWithResult('D')}\n`;
    expect(parse(input)?.players[0]?.results[0]?.result).toBe('D');
  });

  it('parses L result code (unrated loss)', () => {
    const input = `### trf26\n012 T\nXXR 1\n${lineWithResult('L')}\n`;
    expect(parse(input)?.players[0]?.results[0]?.result).toBe('L');
  });

  it('still emits warning for truly unknown result codes', () => {
    const onWarning = vi.fn();
    const input = `012 T\nXXR 1\n${lineWithResult('Q')}\n`;
    parse(input, { onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
  });
});
```

**Step 2: Run to confirm they fail**

```bash
pnpm test
```

**Step 3: Update `src/types.ts`**

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

**Step 4: Update `src/parse.ts`**

```ts
const VALID_RESULT_CODES = new Set<ResultCode>([
  '+',
  '-',
  '0',
  '1',
  '=',
  'D',
  'F',
  'H',
  'L',
  'U',
  'W',
  'Z',
]);
```

**Step 5: Run tests**

```bash
pnpm test
```

**Step 6: Lint**

```bash
pnpm lint
```

**Step 7: Commit**

```bash
git add src/types.ts src/parse.ts src/__tests__/index.spec.ts
git commit -m "feat: add TRF26 result codes W, D, L (unrated games)"
```

---

## Task 5: NRS records (National Rating Support)

**Files:**

- Modify: `src/types.ts`
- Modify: `src/parse.ts`
- Modify: `src/stringify.ts`
- Modify: `src/__tests__/index.spec.ts`

**Step 1: Write failing tests**

```ts
describe('parse — NRS records', () => {
  const NRS_INPUT =
    [
      '### trf26',
      '012 T',
      'XXR 1',
      '001    1 mGM  Kasparov, Garry                   2851 RUS 4100018363   1963-04-13 8.5    1',
      'RUS    1                                         2851                              ',
    ].join('\n') + '\n';

  it('parses NRS record into player.nationalRatings', () => {
    const player = parse(NRS_INPUT)?.players[0];
    expect(player?.nationalRatings).toHaveLength(1);
    expect(player?.nationalRatings?.[0]?.federation).toBe('RUS');
    expect(player?.nationalRatings?.[0]?.rating).toBe(2851);
    expect(player?.nationalRatings?.[0]?.pairingNumber).toBe(1);
  });

  it('does not emit unknown-tag warning for NRS records', () => {
    const onWarning = vi.fn();
    parse(NRS_INPUT, { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});

describe('stringify — NRS records', () => {
  it('emits NRS records after 001 lines when version is TRF26', () => {
    const t: Tournament = {
      players: [
        {
          name: 'Kasparov, Garry',
          nationalRatings: [
            { federation: 'RUS', pairingNumber: 1, rating: 2851 },
          ],
          pairingNumber: 1,
          points: 8.5,
          rank: 1,
          results: [],
        },
      ],
      rounds: 1,
      version: 'TRF26',
    };
    const lines = stringify(t).split('\n');
    const nrsLine = lines.find((l) => l.startsWith('RUS'));
    expect(nrsLine).toBeDefined();
    expect(nrsLine).toContain('2851');
  });

  it('does not emit NRS records for TRF16', () => {
    const t: Tournament = {
      players: [
        {
          name: 'Kasparov, Garry',
          nationalRatings: [
            { federation: 'RUS', pairingNumber: 1, rating: 2851 },
          ],
          pairingNumber: 1,
          points: 8.5,
          rank: 1,
          results: [],
        },
      ],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).not.toMatch(/^RUS/m);
  });
});
```

**Step 2: Run to confirm they fail**

```bash
pnpm test
```

**Step 3: Update `src/types.ts`**

```ts
interface NationalRating {
  birthDate?: string;
  classification?: string;
  federation: string;
  name?: string;
  nationalId?: string;
  origin?: string;
  pairingNumber: number;
  rating: number;
  sex?: Sex;
}

interface Player {
  // ... existing fields ...
  nationalRatings?: NationalRating[];
}
```

**Step 4: Update `src/parse.ts`**

In the `default` case of the switch, before the unknown-tag warning, add NRS
detection:

```ts
default: {
  // NRS record: exactly 3 uppercase letters not in KNOWN_HEADER_TAGS
  if (/^[A-Z]{3}$/.test(tag) && !KNOWN_HEADER_TAGS.has(tag)) {
    const pairingNumber = Number(line.slice(4, 8).trim()) || 0;
    const ratingRaw = line.slice(48, 52).trim();
    const rating = Number(ratingRaw) || 0;
    const player = tournament.players.find(p => p.pairingNumber === pairingNumber);
    if (player !== undefined && rating > 0) {
      player.nationalRatings ??= [];
      const sexRaw = line.slice(9, 10).trim();
      const nrs: NationalRating = {
        federation: tag,
        pairingNumber,
        rating,
      };
      const classification = line.slice(10, 13).trim();
      if (classification) nrs.classification = classification;
      const name = line.slice(14, 47).trim();
      if (name) nrs.name = name;
      const origin = line.slice(53, 56).trim();
      if (origin) nrs.origin = origin;
      const nationalId = line.slice(57, 68).trim();
      if (nationalId) nrs.nationalId = nationalId;
      const birthDate = line.slice(70, 79).trim();
      if (birthDate) nrs.birthDate = birthDate;
      if (VALID_SEXES.has(sexRaw as Sex)) nrs.sex = sexRaw as Sex;
      player.nationalRatings.push(nrs);
    }
    break;
  }

  if (!KNOWN_HEADER_TAGS.has(tag) && tag.trim().length > 0) {
    options?.onWarning?.(
      makeWarning(`Unknown tag "${tag}"`, lineNumber, 1, lineOffset),
    );
  }
  break;
}
```

**Step 5: Update `src/stringify.ts`**

After the `001` player records loop, add NRS emit:

```ts
if (tournament.version === 'TRF26') {
  for (const player of tournament.players) {
    for (const nrs of player.nationalRatings ?? []) {
      const buf: string[] = Array.from({ length: COL_RANK + 5 }, () => ' ');
      buf[0] = nrs.federation[0]!;
      buf[1] = nrs.federation[1]!;
      buf[2] = nrs.federation[2]!;
      writeAt(
        buf,
        COL_PAIRING_NUMBER,
        pad(String(nrs.pairingNumber), 4, 'right'),
      );
      if (nrs.sex) buf[COL_SEX] = nrs.sex;
      if (nrs.classification)
        writeAt(buf, COL_TITLE, pad(nrs.classification, 3, 'left'));
      if (nrs.name)
        writeAt(buf, COL_NAME, pad(nrs.name.slice(0, 33), 33, 'left'));
      writeAt(buf, COL_RATING, pad(String(nrs.rating), 4, 'right'));
      if (nrs.origin)
        writeAt(buf, COL_FEDERATION, pad(nrs.origin.slice(0, 3), 3, 'left'));
      if (nrs.nationalId)
        writeAt(buf, COL_FIDE_ID, pad(nrs.nationalId.slice(0, 11), 11, 'left'));
      if (nrs.birthDate)
        writeAt(
          buf,
          COL_BIRTH_DATE,
          pad(nrs.birthDate.slice(0, 10), 10, 'left'),
        );
      lines.push(buf.join('').trimEnd());
    }
  }
}
```

**Step 6: Run tests**

```bash
pnpm test
```

**Step 7: Lint**

```bash
pnpm lint
```

**Step 8: Commit**

```bash
git add src/types.ts src/parse.ts src/stringify.ts src/__tests__/index.spec.ts
git commit -m "feat: parse and stringify NRS (National Rating Support) records"
```

---

## Task 6: Team records (310 and legacy 013)

**Files:**

- Modify: `src/types.ts`
- Modify: `src/parse.ts`
- Modify: `src/stringify.ts`
- Modify: `src/__tests__/index.spec.ts`

**Step 1: Write failing tests**

```ts
describe('parse — team records (310)', () => {
  const TEAM_INPUT =
    [
      '### trf26',
      '012 T',
      'XXR 2',
      '310   1 India                            IND     2486   15.0   28.0  11     1    5   15   28   44',
      '310   2 Ukraine                          UKR     2478   14.0   26.5  14     2    4   20   27   22',
    ].join('\n') + '\n';

  it('parses teams array', () => {
    expect(parse(TEAM_INPUT)?.teams).toHaveLength(2);
  });

  it('parses team pairingNumber', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.pairingNumber).toBe(1);
  });

  it('parses team name', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.name).toBe('India');
  });

  it('parses team playerIds', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.playerIds).toContain(1);
  });
});

describe('parse — legacy team records (013)', () => {
  const LEGACY_INPUT =
    [
      '012 T',
      'XXR 2',
      '013 India                            0001 0005 0015',
    ].join('\n') + '\n';

  it('parses legacy 013 team records without error', () => {
    const onWarning = vi.fn();
    const result = parse(LEGACY_INPUT, { onWarning });
    expect(result).not.toBeNull();
    expect(onWarning).not.toHaveBeenCalled();
  });
});

describe('stringify — team records', () => {
  it('emits 310 records when version is TRF26', () => {
    const t: Tournament = {
      players: [],
      rounds: 1,
      teams: [
        {
          gamePoints: 28.0,
          matchPoints: 15.0,
          name: 'India',
          pairingNumber: 1,
          playerIds: [1, 5, 15, 28, 44],
          rank: 11,
        },
      ],
      version: 'TRF26',
    };
    expect(stringify(t)).toMatch(/^310/m);
  });

  it('does not emit team records for TRF16', () => {
    const t: Tournament = {
      players: [],
      rounds: 1,
      teams: [
        {
          gamePoints: 0,
          matchPoints: 0,
          name: 'India',
          pairingNumber: 1,
          playerIds: [],
          rank: 1,
        },
      ],
      version: 'TRF16',
    };
    expect(stringify(t)).not.toMatch(/^310/m);
  });
});
```

**Step 2: Run to confirm they fail**

```bash
pnpm test
```

**Step 3: Update `src/types.ts`**

```ts
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

interface Tournament {
  // ... existing fields ...
  teams?: Team[];
}
```

**Step 4: Update `src/parse.ts`**

```ts
case '013': {
  // Legacy team record — parse silently for backward compatibility, do not store
  break;
}
case '310': {
  const pairingNumber = Number(line.slice(4, 7).trim()) || 0;
  const name = line.slice(8, 40).trim();
  const nickname = line.slice(41, 46).trim() || undefined;
  const strengthFactor = Number(line.slice(47, 53).trim()) || undefined;
  const matchPoints = Number(line.slice(54, 60).trim()) || 0;
  const gamePoints = Number(line.slice(61, 67).trim()) || 0;
  const rank = Number(line.slice(68, 71).trim()) || 0;
  const playerIds: number[] = [];
  // Player IDs start at position 73, each 4 chars separated by 1 space
  for (let pos = 73; pos < line.length; pos += 5) {
    const id = Number(line.slice(pos, pos + 4).trim());
    if (id > 0) playerIds.push(id);
  }
  tournament.teams ??= [];
  tournament.teams.push({ gamePoints, matchPoints, name, nickname, pairingNumber, playerIds, rank, strengthFactor });
  break;
}
```

Remove `'310'` from `KNOWN_HEADER_TAGS`.

**Step 5: Update `src/stringify.ts`**

After player records and NRS records:

```ts
if (tournament.version === 'TRF26') {
  for (const team of tournament.teams ?? []) {
    const parts: string[] = [];
    parts.push('310');
    parts.push(String(team.pairingNumber).padStart(4));
    parts.push(' ');
    parts.push(team.name.padEnd(32));
    parts.push(' ');
    parts.push((team.nickname ?? '').padEnd(5));
    parts.push(' ');
    parts.push(
      (team.strengthFactor !== undefined
        ? String(team.strengthFactor)
        : ''
      ).padEnd(6),
    );
    parts.push(' ');
    parts.push(team.matchPoints.toFixed(1).padStart(6));
    parts.push(' ');
    parts.push(team.gamePoints.toFixed(1).padStart(6));
    parts.push(' ');
    parts.push(String(team.rank).padStart(3));
    for (const id of team.playerIds) {
      parts.push('  ');
      parts.push(String(id).padStart(4));
    }
    lines.push(parts.join('').trimEnd());
  }
}
```

**Step 6: Run tests**

```bash
pnpm test
```

**Step 7: Lint**

```bash
pnpm lint
```

**Step 8: Commit**

```bash
git add src/types.ts src/parse.ts src/stringify.ts src/__tests__/index.spec.ts
git commit -m "feat: parse and stringify TRF26 team records (310), silently accept 013"
```

---

## Task 7: Bye records (240), prohibited pairings (260), accelerated rounds (250)

**Files:**

- Modify: `src/types.ts`
- Modify: `src/parse.ts`
- Modify: `src/stringify.ts`
- Modify: `src/__tests__/index.spec.ts`

**Step 1: Write failing tests**

```ts
describe('parse — bye records (240)', () => {
  const BYE_INPUT = '### trf26\n012 T\nXXR 3\n240 H 003  026  047\n';

  it('parses bye record', () => {
    expect(parse(BYE_INPUT)?.byes).toHaveLength(1);
  });

  it('parses bye type', () => {
    expect(parse(BYE_INPUT)?.byes?.[0]?.type).toBe('H');
  });

  it('parses bye round', () => {
    expect(parse(BYE_INPUT)?.byes?.[0]?.round).toBe(3);
  });

  it('parses bye playerIds', () => {
    expect(parse(BYE_INPUT)?.byes?.[0]?.playerIds).toEqual([26, 47]);
  });
});

describe('parse — prohibited pairings (260)', () => {
  const PP_INPUT = '### trf26\n012 T\nXXR 2\n260 001 002  125  180  216\n';

  it('parses prohibited pairing record', () => {
    expect(parse(PP_INPUT)?.prohibitedPairings).toHaveLength(1);
  });

  it('parses first and last round', () => {
    expect(parse(PP_INPUT)?.prohibitedPairings?.[0]?.firstRound).toBe(1);
    expect(parse(PP_INPUT)?.prohibitedPairings?.[0]?.lastRound).toBe(2);
  });

  it('parses playerIds', () => {
    expect(parse(PP_INPUT)?.prohibitedPairings?.[0]?.playerIds).toEqual([
      125, 180, 216,
    ]);
  });
});

describe('parse — accelerated rounds (250)', () => {
  const ACC_INPUT =
    '### trf26\n012 T\nXXR 9\n250 00.0 02.0 001 003 0001 0090\n';

  it('parses accelerated round record', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds).toHaveLength(1);
  });

  it('parses game points', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.gamePoints).toBe(2.0);
  });

  it('parses round range', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.firstRound).toBe(1);
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.lastRound).toBe(3);
  });

  it('parses player range', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.firstPlayerId).toBe(1);
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.lastPlayerId).toBe(90);
  });
});
```

Add corresponding stringify tests for each record type.

**Step 2: Run to confirm they fail**

```bash
pnpm test
```

**Step 3: Update `src/types.ts`**

```ts
interface AcceleratedRound {
  firstPlayerId: number;
  firstRound: number;
  gamePoints: number;
  lastPlayerId: number;
  lastRound: number;
  matchPoints: number;
}

interface Bye {
  playerIds: number[];
  round: number;
  type: 'F' | 'H' | 'Z';
}

interface ProhibitedPairing {
  firstRound: number;
  lastRound: number;
  playerIds: number[];
}

interface Tournament {
  // ... existing fields ...
  acceleratedRounds?: AcceleratedRound[];
  byes?: Bye[];
  prohibitedPairings?: ProhibitedPairing[];
}
```

**Step 4: Update `src/parse.ts`** — add cases for `240`, `250`, `260`, remove
from `KNOWN_HEADER_TAGS`.

**Step 5: Update `src/stringify.ts`** — emit `240`, `250`, `260` when
`version === 'TRF26'`.

**Step 6: Run tests, lint, commit**

```bash
pnpm test && pnpm lint
git add src/types.ts src/parse.ts src/stringify.ts src/__tests__/index.spec.ts
git commit -m "feat: parse and stringify TRF26 records 240/250/260 (byes, prohibited pairings, accelerated rounds)"
```

---

## Task 8: Forfeited matches (330), out-of-order lineups (300), abnormal points (299), team PAB (320)

Same pattern as Task 7. Add the remaining TRF26 record types.

**Files:**

- Modify: `src/types.ts`
- Modify: `src/parse.ts`
- Modify: `src/stringify.ts`
- Modify: `src/__tests__/index.spec.ts`

**New types:**

```ts
interface AbnormalPoints {
  gamePoints: number;
  matchPoints: number;
  playerIds: number[];
  round: number;
  type: ' ' | '+' | '-' | 'D' | 'F' | 'H' | 'L' | 'W' | 'Z';
}

interface ForfeitedMatch {
  blackTeamId: number;
  round: number;
  type: '--' | '-+' | '+-';
  whiteTeamId: number;
}

interface OutOfOrderLineup {
  opponentTeamId: number;
  playerIds: (number | null)[];
  round: number;
  teamId: number;
}

interface TeamPairingAllocatedBye {
  gamePoints: number;
  matchPoints: number;
  teamIdPerRound: (number | null)[];
}

interface Tournament {
  // ... existing fields ...
  abnormalPoints?: AbnormalPoints[];
  forfeitedMatches?: ForfeitedMatch[];
  outOfOrderLineups?: OutOfOrderLineup[];
  teamPairingAllocatedByes?: TeamPairingAllocatedBye;
}
```

Write one test per field for each record type. Follow the same TDD pattern as
Task 7.

After implementation:

```bash
pnpm test && pnpm lint
git add src/types.ts src/parse.ts src/stringify.ts src/__tests__/index.spec.ts
git commit -m "feat: parse and stringify TRF26 records 299/300/320/330"
```

---

## Task 9: Add TRF26 fixture and full round-trip test

**Files:**

- Create: `src/__tests__/fixtures/trf26_team.trf`
- Modify: `src/__tests__/index.spec.ts`

**Step 1: Create fixture**

Use the examples from `SPEC.md` to create a minimal but representative TRF26
file with:

- `###` comment
- Tournament tags including `152`, `182`
- Two `001` player records
- One NRS record
- One `310` team record
- One `240` bye record
- One `260` prohibited pairing record

**Step 2: Write round-trip test**

```ts
describe('TRF26 round-trip', () => {
  it('parse → stringify → parse produces identical Tournament', () => {
    const input = fixture('trf26_team');
    const first = parse(input);
    expect(first).not.toBeNull();
    expect(first?.version).toBe('TRF26');
    const reserialized = stringify(first!);
    const second = parse(reserialized);
    expect(second).toEqual(first);
  });
});
```

**Step 3: Run test**

```bash
pnpm test
```

**Step 4: Lint**

```bash
pnpm lint
```

**Step 5: Commit**

```bash
git add src/__tests__/fixtures/trf26_team.trf src/__tests__/index.spec.ts
git commit -m "test: add TRF26 fixture and round-trip test"
```

---

## Task 10: Final verification

```bash
pnpm lint && pnpm test && pnpm build
```

All must pass. Fix any remaining issues, then commit if needed.

---

## Out of Scope (deferred)

- Full structured parsing of tags `162`, `172`, `192`, `202`, `212`, `222`,
  `352`, `362`
- Records `801` / `802` (informative only — recognised, no warning, not stored,
  not emitted)
- Record `013` (parsed silently, never stringified — TRF26 uses `310`)
