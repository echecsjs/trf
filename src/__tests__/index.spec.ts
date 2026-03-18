import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { parse, stringify } from '../index.js';

import type { ParseError, ParseWarning, Tournament } from '../types.js';

function fixture(name: string): string {
  return readFileSync(
    path.join(import.meta.dirname, 'fixtures', `${name}.trf`),
    'utf8',
  );
}

// ---------------------------------------------------------------------------
// Null / failure cases
// ---------------------------------------------------------------------------
describe('parse — failure cases', () => {
  it('returns null for empty input', () => {
    expect(parse('')).toBeNull();
  });

  it('calls onError for empty input', () => {
    const onError = vi.fn<(error: ParseError) => void>();
    parse('', { onError });
    expect(onError).toHaveBeenCalledOnce();
  });

  it('returns null for whitespace-only input', () => {
    expect(parse('   \n  ')).toBeNull();
  });

  it('strips BOM before parsing', () => {
    const result = parse('\uFEFF012 My Tournament\nXXR 5\n');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('My Tournament');
  });
});

// ---------------------------------------------------------------------------
// Header tag parsing
// ---------------------------------------------------------------------------
describe('parse — header tags', () => {
  it('parses tournament name from 012 tag', () => {
    expect(parse('012 My Tournament\nXXR 3\n')?.name).toBe('My Tournament');
  });

  it('parses city from 022 tag', () => {
    expect(parse('012 T\n022 Paris\nXXR 1\n')?.city).toBe('Paris');
  });

  it('parses federation from 032 tag', () => {
    expect(parse('012 T\n032 FRA\nXXR 1\n')?.federation).toBe('FRA');
  });

  it('parses start date from 042 tag', () => {
    expect(parse('012 T\n042 2026-01-01\nXXR 1\n')?.startDate).toBe(
      '2026-01-01',
    );
  });

  it('parses end date from 052 tag', () => {
    expect(parse('012 T\n052 2026-01-07\nXXR 1\n')?.endDate).toBe('2026-01-07');
  });

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

  it('parses rounds from XXR tag', () => {
    expect(parse('012 T\nXXR 9\n')?.rounds).toBe(9);
  });

  it('emits onWarning for unknown tag codes', () => {
    const onWarning = vi.fn();
    const result = parse('012 T\nXXR 1\nZZZ unknown tag\n', { onWarning });
    expect(result).not.toBeNull();
    expect(onWarning).toHaveBeenCalledOnce();
  });

  it('returns version TRF16 for standard input', () => {
    expect(parse('012 T\nXXR 1\n')?.version).toBe('TRF16');
  });

  it('returns tournament with empty players when no 001 lines', () => {
    const result = parse('012 Empty\nXXR 5\n');
    expect(result?.players).toHaveLength(0);
    expect(result?.rounds).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Player parsing
// ---------------------------------------------------------------------------
describe('parse — player fields', () => {
  it('parses pairing number', () => {
    expect(parse(fixture('dutch_2025_C5'))?.players[0]?.pairingNumber).toBe(1);
  });

  it('parses player name', () => {
    expect(parse(fixture('dutch_2025_C5'))?.players[0]?.name).toBe(
      'Test0001 Player0001',
    );
  });

  it('parses rating', () => {
    expect(parse(fixture('dutch_2025_C5'))?.players[0]?.rating).toBe(2720);
  });

  it('parses points', () => {
    expect(parse(fixture('dutch_2025_C5'))?.players[0]?.points).toBe(2);
  });

  it('parses rank', () => {
    expect(parse(fixture('dutch_2025_C5'))?.players[0]?.rank).toBe(1);
  });

  it('emits onWarning and sets rating undefined for malformed rating', () => {
    const onWarning = vi.fn();
    const line =
      '001    1      Test Name                        XXXX                             1.0    1';
    const result = parse(`012 T\nXXR 1\n${line}\n`, { onWarning });
    expect(result?.players[0]?.rating).toBeUndefined();
    expect(onWarning).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// Optional player fields (sex, title, fideId, birthDate, federation)
// ---------------------------------------------------------------------------
describe('parse — optional player fields', () => {
  // A fully-populated 001 line with all optional fields.
  // Column layout (0-indexed) verified against TRF16 spec:
  //  9     sex          → 'm'
  //  10-13 title        → 'GM  '
  //  14-46 name         → 'Kasparov, Garry'
  //  48-51 rating       → 2851
  //  53-55 federation   → 'RUS'
  //  57-68 FIDE ID      → '4100018363'
  //  70-79 birth date   → '1963-04-13'
  const FULL_LINE =
    '001    1 mGM  Kasparov, Garry                   2851 RUS 4100018363   1963-04-13 8.5    1      2 w 1';

  function parseFullLine() {
    return parse(`012 T\nXXR 1\n${FULL_LINE}\n`)?.players[0];
  }

  it('parses sex field', () => {
    expect(parseFullLine()?.sex).toBe('m');
  });

  it('parses title field', () => {
    expect(parseFullLine()?.title).toBe('GM');
  });

  it('parses name field', () => {
    expect(parseFullLine()?.name).toBe('Kasparov, Garry');
  });

  it('parses federation field', () => {
    expect(parseFullLine()?.federation).toBe('RUS');
  });

  it('parses fideId field', () => {
    expect(parseFullLine()?.fideId).toBe('4100018363');
  });

  it('parses birthDate field', () => {
    expect(parseFullLine()?.birthDate).toBe('1963-04-13');
  });

  it('returns undefined sex for blank field', () => {
    const line =
      '001    1      Test0001 Player0001               2720                             2.0    1';
    expect(parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.sex).toBeUndefined();
  });

  it('returns undefined title for blank field', () => {
    const line =
      '001    1      Test0001 Player0001               2720                             2.0    1';
    expect(parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.title).toBeUndefined();
  });

  it('returns undefined federation for blank field', () => {
    const line =
      '001    1      Test0001 Player0001               2720                             2.0    1';
    expect(
      parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.federation,
    ).toBeUndefined();
  });

  it('returns undefined fideId for blank field', () => {
    const line =
      '001    1      Test0001 Player0001               2720                             2.0    1';
    expect(
      parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.fideId,
    ).toBeUndefined();
  });

  it('returns undefined birthDate for blank field', () => {
    const line =
      '001    1      Test0001 Player0001               2720                             2.0    1';
    expect(
      parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.birthDate,
    ).toBeUndefined();
  });

  it('ignores unknown sex code', () => {
    // Replace sex byte ('m') with 'x' — not a valid sex code
    const line = FULL_LINE.slice(0, 9) + 'x' + FULL_LINE.slice(10);
    expect(parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.sex).toBeUndefined();
  });

  it('ignores unknown title', () => {
    // Replace title ('GM  ') with 'XX  '
    const line = FULL_LINE.slice(0, 10) + 'XX  ' + FULL_LINE.slice(14);
    expect(parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.title).toBeUndefined();
  });

  it('all valid titles are accepted', () => {
    const titles = ['CM', 'FM', 'GM', 'IM', 'WCM', 'WFM', 'WGM', 'WIM'];
    for (const title of titles) {
      const padded = title.padEnd(4);
      const line = FULL_LINE.slice(0, 10) + padded + FULL_LINE.slice(14);
      expect(
        parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.title,
        `expected title ${title} to be parsed`,
      ).toBe(title);
    }
  });
});

// ---------------------------------------------------------------------------
// Round result parsing
// ---------------------------------------------------------------------------
describe('parse — round results', () => {
  it('parses win result', () => {
    const result = parse(fixture('dutch_2025_C5'));
    const p1 = result?.players[0];
    const r1 = p1?.results[0];
    expect(r1?.result).toBe('1');
    expect(r1?.color).toBe('w');
    expect(r1?.opponentId).toBe(4);
    expect(r1?.round).toBe(1);
  });

  it('parses loss result', () => {
    const result = parse(fixture('dutch_2025_C5'));
    const p2 = result?.players[1];
    const r2 = p2?.results.find((r) => r.result === '0');
    expect(r2?.color).toBe('w');
  });

  it('parses draw result', () => {
    const result = parse(fixture('issue_7'));
    const p1 = result?.players[0];
    const drawResult = p1?.results.find((r) => r.result === '=');
    expect(drawResult).toBeDefined();
  });

  it('parses Z-bye with opponentId null', () => {
    const result = parse(fixture('dutch_2025_C5'));
    const p4 = result?.players[3];
    const zBye = p4?.results.find((r) => r.result === 'Z');
    expect(zBye).toBeDefined();
    expect(zBye?.opponentId).toBeNull();
    expect(zBye?.color).toBe('-');
  });

  it('parses forfeit win (+) present in issue_7', () => {
    const result = parse(fixture('issue_7'));
    const allResults = result?.players.flatMap((p) =>
      p.results.map((r) => r.result),
    );
    expect(allResults).toContain('+');
  });

  it('preserves - color for half-point bye', () => {
    const playerLine =
      '001    1      Test0001 Player0001               2720                             1.0    1  0000 - H  ';
    const result = parse(`012 T\nXXR 1\n${playerLine}\n`);
    const r = result?.players[0]?.results[0];
    expect(r?.color).toBe('-');
    expect(r?.result).toBe('H');
    expect(r?.opponentId).toBeNull();
  });

  it('preserves - color for zero-point bye', () => {
    const playerLine =
      '001    1      Test0001 Player0001               2720                             0.0    1  0000 - Z  ';
    const result = parse(`012 T\nXXR 1\n${playerLine}\n`);
    const r = result?.players[0]?.results[0];
    expect(r?.color).toBe('-');
    expect(r?.result).toBe('Z');
  });
});

// ---------------------------------------------------------------------------
// Fixture integration tests
// ---------------------------------------------------------------------------
describe('parse — dutch_2025_C5 fixture', () => {
  it('parses 6 players', () => {
    expect(parse(fixture('dutch_2025_C5'))?.players).toHaveLength(6);
  });

  it('parses rounds as 3', () => {
    expect(parse(fixture('dutch_2025_C5'))?.rounds).toBe(3);
  });

  it('parses correct ratings for all players', () => {
    const players = parse(fixture('dutch_2025_C5'))?.players ?? [];
    expect(players.map((p) => p.rating)).toEqual([
      2720, 2701, 2697, 2689, 2673, 2664,
    ]);
  });
});

describe('parse — dutch_2025_C9 fixture', () => {
  it('parses 5 players', () => {
    expect(parse(fixture('dutch_2025_C9'))?.players).toHaveLength(5);
  });

  it('parses rounds as 3', () => {
    expect(parse(fixture('dutch_2025_C9'))?.rounds).toBe(3);
  });
});

describe('parse — issue_7 fixture', () => {
  it('parses 60 players', () => {
    expect(parse(fixture('issue_7'))?.players).toHaveLength(60);
  });

  it('parses rounds as 15', () => {
    expect(parse(fixture('issue_7'))?.rounds).toBe(15);
  });

  it('parses P1 score as 10.5', () => {
    expect(parse(fixture('issue_7'))?.players[0]?.points).toBe(10.5);
  });
});

// ---------------------------------------------------------------------------
// Sex and title parsing
// ---------------------------------------------------------------------------
describe('parse — sex and title fields', () => {
  it('parses sex field', () => {
    const line =
      '001    1 m    Test Name                        2000                             1.0    1';
    const result = parse(`012 T\nXXR 1\n${line}\n`);
    expect(result?.players[0]?.sex).toBe('m');
  });

  it('parses title field', () => {
    const line =
      '001    1  GM  Test Name                        2000                             1.0    1';
    const result = parse(`012 T\nXXR 1\n${line}\n`);
    expect(result?.players[0]?.title).toBe('GM');
  });

  it('ignores unknown title', () => {
    const line =
      '001    1  XX  Test Name                        2000                             1.0    1';
    const result = parse(`012 T\nXXR 1\n${line}\n`);
    expect(result?.players[0]?.title).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// JaVaFo backward-compatible single-letter title codes
// JaVaFo (pre-TRF16) used single lowercase letters at col 10 instead of the
// standard 2-4 char title codes. The parser maps them for compatibility.
// ---------------------------------------------------------------------------
function parseJaVaFoTitle(titleChar: string): string | undefined {
  // Place titleChar at col 10, rest of title field (cols 11-13) as spaces
  const line = `001    1 m  ${titleChar} Test Name                        2000                             1.0    1`;
  return parse(`012 T\nXXR 1\n${line}\n`)?.players[0]?.title;
}

describe('parse — JaVaFo single-letter title codes', () => {
  it('maps "g" to GM', () => {
    expect(parseJaVaFoTitle('g')).toBe('GM');
  });

  it('maps "m" to IM', () => {
    expect(parseJaVaFoTitle('m')).toBe('IM');
  });

  it('maps "f" to FM', () => {
    expect(parseJaVaFoTitle('f')).toBe('FM');
  });

  it('maps "w" to WIM', () => {
    expect(parseJaVaFoTitle('w')).toBe('WIM');
  });

  it('ignores unknown single-letter code', () => {
    expect(parseJaVaFoTitle('x')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// XXR missing
// ---------------------------------------------------------------------------
describe('parse — XXR tag', () => {
  it('returns rounds 0 when XXR tag is absent', () => {
    expect(parse('012 T\n')?.rounds).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// issue_15 fixture
// ---------------------------------------------------------------------------
describe('parse — issue_15 fixture', () => {
  it('parses 180 players', () => {
    expect(parse(fixture('issue_15'))?.players).toHaveLength(180);
  });

  it('parses rounds as 12', () => {
    expect(parse(fixture('issue_15'))?.rounds).toBe(12);
  });

  it('parses P1 score as 8.0', () => {
    expect(parse(fixture('issue_15'))?.players[0]?.points).toBe(8);
  });

  it('parses P1 rating as 2761', () => {
    expect(parse(fixture('issue_15'))?.players[0]?.rating).toBe(2761);
  });

  it('parses 11 round results for P1', () => {
    const p1 = parse(fixture('issue_15'))?.players[0];
    expect(p1?.results).toHaveLength(11);
  });

  it('does not return null', () => {
    expect(parse(fixture('issue_15'))).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Round number assignment
// ---------------------------------------------------------------------------
describe('parse — round number assignment', () => {
  it('assigns correct round numbers to results', () => {
    const result = parse(fixture('dutch_2025_C5'));
    const p1 = result?.players[0];
    // P1: R1 as white vs P4, R2 as black vs P2
    expect(p1?.results[0]?.round).toBe(1);
    expect(p1?.results[1]?.round).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Real-world fixture: JaVaFo TRFXSample2
// Source: https://www.rrweb.org/javafo/aum/TRFXSample2.txt
// JaVaFo documentation example (freely distributed). 52-player Spanish open,
// 4 of 9 rounds played. Uses TRF16 result codes + JaVaFo single-letter titles.
// ---------------------------------------------------------------------------
describe('parse — javafo_sample2 fixture', () => {
  it('does not return null', () => {
    expect(parse(fixture('javafo_sample2'))).not.toBeNull();
  });

  it('parses tournament name', () => {
    expect(parse(fixture('javafo_sample2'))?.name).toBe(
      'XX Open Internacional de Gros',
    );
  });

  it('parses city', () => {
    expect(parse(fixture('javafo_sample2'))?.city).toBe('Donostia');
  });

  it('parses federation', () => {
    expect(parse(fixture('javafo_sample2'))?.federation).toBe('ESP');
  });

  it('parses start date', () => {
    expect(parse(fixture('javafo_sample2'))?.startDate).toBe('24/09/2010');
  });

  it('parses end date', () => {
    expect(parse(fixture('javafo_sample2'))?.endDate).toBe('02/10/2010');
  });

  it('parses rounds from XXR tag', () => {
    expect(parse(fixture('javafo_sample2'))?.rounds).toBe(9);
  });

  it('parses 52 players', () => {
    expect(parse(fixture('javafo_sample2'))?.players).toHaveLength(52);
  });

  it('parses P1 name', () => {
    expect(parse(fixture('javafo_sample2'))?.players[0]?.name).toBe(
      'Mirzoev Azer',
    );
  });

  it('parses P1 rating', () => {
    expect(parse(fixture('javafo_sample2'))?.players[0]?.rating).toBe(2527);
  });

  it('parses P1 federation', () => {
    expect(parse(fixture('javafo_sample2'))?.players[0]?.federation).toBe(
      'AZE',
    );
  });

  it('parses P1 sex', () => {
    expect(parse(fixture('javafo_sample2'))?.players[0]?.sex).toBe('m');
  });

  it('parses female player sex (P23)', () => {
    expect(parse(fixture('javafo_sample2'))?.players[22]?.sex).toBe('w');
  });

  it('parses P1 FIDE ID', () => {
    expect(parse(fixture('javafo_sample2'))?.players[0]?.fideId).toBe(
      '13400304',
    );
  });

  it('parses 4 round results for P1', () => {
    expect(parse(fixture('javafo_sample2'))?.players[0]?.results).toHaveLength(
      4,
    );
  });

  it('parses Z-bye result code for P28 (withdrew)', () => {
    // P28 (index 27) has Z-bye in all 5 recorded result slots
    const p28 = parse(fixture('javafo_sample2'))?.players[27];
    expect(p28?.results.every((r) => r.result === 'Z')).toBe(true);
  });

  it('parses H (half-point bye) result code', () => {
    // P14 (index 13) has an H bye in round 3
    const p14 = parse(fixture('javafo_sample2'))?.players[13];
    const hBye = p14?.results.find((r) => r.result === 'H');
    expect(hBye).toBeDefined();
    expect(hBye?.opponentId).toBeNull();
    expect(hBye?.color).toBe('-');
  });

  it('parses U (unplayed) result code', () => {
    // P48 (index 47) has a U entry in round 4
    const p48 = parse(fixture('javafo_sample2'))?.players[47];
    const unplayed = p48?.results.find((r) => r.result === 'U');
    expect(unplayed).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Real-world fixture: GrandMommysCup TRF25 sample
// Source: http://tec.fide.com/wp-content/uploads/2025/01/GrandMommysCup03_trf.txt
// FIDE Technical Commission official sample (January 2025). 249 players,
// 50 teams, 14 rounds. Exercises many TRF25-specific record types.
// We only assert that parsing succeeds and basic counts are correct —
// the TRF25-specific tags are unknown to our TRF16 parser and will emit warnings.
// ---------------------------------------------------------------------------
describe('parse — grandmommyscup fixture', () => {
  it('does not return null', () => {
    expect(parse(fixture('grandmommyscup'))).not.toBeNull();
  });

  it('parses tournament name', () => {
    expect(parse(fixture('grandmommyscup'))?.name).toBe("Grandmommy's Cup");
  });

  it('parses 249 players from 001 lines', () => {
    expect(parse(fixture('grandmommyscup'))?.players).toHaveLength(249);
  });

  it('parses rounds from 142 tag', () => {
    // The GrandMommysCup uses tag 142 for rounds instead of XXR.
    // Our parser now recognises 142 as a rounds tag (TRF26).
    expect(parse(fixture('grandmommyscup'))?.rounds).toBe(14);
  });

  it('parses P1 name', () => {
    expect(parse(fixture('grandmommyscup'))?.players[0]?.name).toBe(
      'Test0001 Player0001',
    );
  });

  it('parses P1 rating', () => {
    expect(parse(fixture('grandmommyscup'))?.players[0]?.rating).toBe(2586);
  });

  it('parses P1 federation', () => {
    expect(parse(fixture('grandmommyscup'))?.players[0]?.federation).toBe(
      'IND',
    );
  });

  it('emits onWarning for unknown TRF25 tags but does not crash', () => {
    const warnings: string[] = [];
    parse(fixture('grandmommyscup'), {
      onWarning: (w) => warnings.push(w.message),
    });
    // Many TRF25-specific tags will trigger warnings
    expect(warnings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// ParseError / ParseWarning position accuracy
// ---------------------------------------------------------------------------
describe('parse — error position accuracy', () => {
  it('empty input error has line 0, column 0, offset 0', () => {
    const onError = vi.fn<(error: ParseError) => void>();
    parse('', { onError });
    expect(onError).toHaveBeenCalledOnce();
    const error = onError.mock.calls[0]?.[0];
    expect(error?.line).toBe(0);
    expect(error?.column).toBe(0);
    expect(error?.offset).toBe(0);
  });
});

describe('parse — warning position accuracy', () => {
  it('unknown tag warning has accurate line number', () => {
    // Line 1: "012 T\n" (6 chars), line 2: "XXR 1\n" (6 chars), line 3: "ZZZ unknown\n"
    const onWarning = vi.fn();
    parse('012 T\nXXR 1\nZZZ unknown\n', { onWarning });
    const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
    expect(warn.line).toBe(3);
    expect(warn.column).toBe(1);
    // offset: "012 T\n" = 6, "XXR 1\n" = 6, total = 12
    expect(warn.offset).toBe(12);
  });

  it('malformed rating warning has accurate line, column, and offset', () => {
    // Line 1: "012 T\n" = 6 chars → lineOffset of line 2 = 6
    // Line 2: "XXR 1\n" = 6 chars → lineOffset of line 3 = 12
    // Line 3 is the 001 player line. COL_RATING = 48 (0-indexed), so column = 49, offset = 12 + 48 = 60
    const onWarning = vi.fn();
    const playerLine =
      '001    1      Test Name                        XXXX                             1.0    1';
    parse(`012 T\nXXR 1\n${playerLine}\n`, { onWarning });
    const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
    expect(warn.line).toBe(3);
    expect(warn.column).toBe(49); // COL_RATING + 1
    expect(warn.offset).toBe(60); // 6 + 6 + 48
  });

  it('unknown result code warning has accurate line and column', () => {
    // Round 1 result is the first entry in the results section at column 92 (1-indexed)
    // (ROUND_RESULTS_OFFSET=91, index=0 → entryColumn = 91+0+1 = 92)
    // Use a correctly-padded 001 line so the rating field (cols 48-51) is valid.
    const onWarning = vi.fn();
    const playerLine =
      '001    1      Test0001 Player0001               2720                             2.0    1      2 w X';
    parse(`012 T\nXXR 1\n${playerLine}\n`, { onWarning });
    const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
    expect(warn.line).toBe(3);
    expect(warn.column).toBe(92); // ROUND_RESULTS_OFFSET + 1
  });
});

// ---------------------------------------------------------------------------
// Round result edge cases
// ---------------------------------------------------------------------------
describe('parse — round result edge cases', () => {
  it('skips a round entry with fewer than 3 parts', () => {
    // A round entry that has only one token (no color or result) is silently skipped
    const playerLine =
      '001    1      Test0001 Player0001               2720                             2.0    1   2';
    const result = parse(`012 T\nXXR 1\n${playerLine}\n`);
    expect(result?.players[0]?.results).toHaveLength(0);
  });

  it('emits onWarning and skips a round entry with an invalid color code', () => {
    const onWarning = vi.fn();
    // Color byte replaced with 'x' — not a valid color code
    const playerLine =
      '001    1      Test0001 Player0001               2720                             2.0    1      2 x 1';
    const result = parse(`012 T\nXXR 1\n${playerLine}\n`, { onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
    expect(onWarning.mock.calls[0]?.[0].message).toMatch(/invalid color code/i);
    expect(result?.players[0]?.results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Version detection
// ---------------------------------------------------------------------------
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

  it('returns TRF26 when 250 record is present', () => {
    expect(
      parse('012 T\nXXR 1\n250 00.0 02.0 001 003 0001 0090\n')?.version,
    ).toBe('TRF26');
  });

  it('returns TRF26 when an NRS record (3 uppercase letter tag) is present', () => {
    // NRS records use the federation code as the record type (e.g. RUS, FRA)
    expect(
      parse(
        '012 T\nXXR 1\nRUS    1                                        2851\n',
      )?.version,
    ).toBe('TRF26');
  });
});

// ---------------------------------------------------------------------------
// Comment lines
// ---------------------------------------------------------------------------
describe('parse — comment lines', () => {
  it('collects ### comment lines into comments array', () => {
    const result = parse('### first comment\n### second\n012 T\nXXR 1\n');
    expect(result?.comments).toEqual(['first comment', 'second']);
  });

  it('comments array is undefined when no ### lines present', () => {
    expect(parse('012 T\nXXR 1\n')?.comments).toBeUndefined();
  });

  it('### lines do not cause unknown-tag warnings', () => {
    const onWarning = vi.fn();
    parse('### comment\n012 T\nXXR 1\n', { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// NRS records
// ---------------------------------------------------------------------------
describe('parse — NRS records', () => {
  const NRS_INPUT =
    [
      '### trf26',
      '012 T',
      'XXR 1',
      '001    1 mGM  Kasparov, Garry                   2851 RUS 4100018363   1963-04-13 8.5    1',
      'RUS    1                                        2851',
    ].join('\n') + '\n';

  it('parses NRS record into player.nationalRatings', () => {
    const player = parse(NRS_INPUT)?.players[0];
    expect(player?.nationalRatings).toHaveLength(1);
  });

  it('parses NRS federation code', () => {
    expect(parse(NRS_INPUT)?.players[0]?.nationalRatings?.[0]?.federation).toBe(
      'RUS',
    );
  });

  it('parses NRS rating', () => {
    expect(parse(NRS_INPUT)?.players[0]?.nationalRatings?.[0]?.rating).toBe(
      2851,
    );
  });

  it('parses NRS pairingNumber', () => {
    expect(
      parse(NRS_INPUT)?.players[0]?.nationalRatings?.[0]?.pairingNumber,
    ).toBe(1);
  });

  it('does not emit onWarning for NRS records', () => {
    const onWarning = vi.fn();
    parse(NRS_INPUT, { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('NRS record with no matching player is silently ignored', () => {
    const onWarning = vi.fn();
    const input =
      '### trf26\n012 T\nXXR 1\nRUS   99                                        2851\n';
    const result = parse(input, { onWarning });
    expect(result?.players).toHaveLength(0);
    expect(onWarning).not.toHaveBeenCalled();
  });
});

function playerWithNRS(): Tournament {
  return {
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
    version: 'TRF26' as const,
  };
}

describe('stringify — NRS records', () => {
  it('emits NRS records after 001 lines when version is TRF26', () => {
    const lines = stringify(playerWithNRS()).split('\n');
    const nrsLine = lines.find((l) => l.startsWith('RUS'));
    expect(nrsLine).toBeDefined();
  });

  it('NRS line contains the national rating', () => {
    const lines = stringify(playerWithNRS()).split('\n');
    const nrsLine = lines.find((l) => l.startsWith('RUS'));
    expect(nrsLine).toContain('2851');
  });

  it('NRS line comes after the 001 line', () => {
    const lines = stringify(playerWithNRS())
      .split('\n')
      .filter((l) => l.length > 0);
    const p001Index = lines.findIndex((l) => l.startsWith('001'));
    const nrsIndex = lines.findIndex((l) => l.startsWith('RUS'));
    expect(nrsIndex).toBeGreaterThan(p001Index);
  });

  it('does not emit NRS records for TRF16', () => {
    const t = { ...playerWithNRS(), version: 'TRF16' as const };
    expect(stringify(t)).not.toMatch(/^RUS/m);
  });
});

// ---------------------------------------------------------------------------
// Stringify tests
// ---------------------------------------------------------------------------
describe('stringify — header tags', () => {
  it('stringifies tournamentType as 092', () => {
    const t: Tournament = {
      players: [],
      rounds: 1,
      tournamentType: 'Swiss',
      version: 'TRF16',
    };
    expect(stringify(t)).toContain('092 Swiss');
  });

  it('stringifies chiefArbiter as 102', () => {
    const t: Tournament = {
      chiefArbiter: 'Smith',
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).toContain('102 Smith');
  });

  it('stringifies each deputyArbiter as 112', () => {
    const t: Tournament = {
      deputyArbiters: ['A', 'B'],
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    const out = stringify(t);
    expect(out).toContain('112 A');
    expect(out).toContain('112 B');
  });

  it('stringifies timeControl as 122', () => {
    const t: Tournament = {
      players: [],
      rounds: 1,
      timeControl: '90+30',
      version: 'TRF16',
    };
    expect(stringify(t)).toContain('122 90+30');
  });

  it('stringifies numberOfPlayers as 062', () => {
    const t: Tournament = {
      numberOfPlayers: 100,
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).toContain('062 100');
  });

  it('stringifies numberOfRatedPlayers as 072', () => {
    const t: Tournament = {
      numberOfRatedPlayers: 80,
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).toContain('072 80');
  });

  it('stringifies numberOfTeams as 082', () => {
    const t: Tournament = {
      numberOfTeams: 10,
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).toContain('082 10');
  });
});

// ---------------------------------------------------------------------------
// TRF26 result codes (W, D, L — unrated games)
// ---------------------------------------------------------------------------

// Columns (0-indexed): 001 at 0-2, pairing at 4-7, name at 14-46 (33 chars),
// rating at 48-51, points at 80-83, rank at 84-88, results at 91+.
// This mirrors the layout used in the existing round result edge-case tests.
function playerLineWithResult(result: string): string {
  return `001    1      Test0001 Player0001               2720                             2.0    1      2 w ${result}`;
}

describe('parse — TRF26 result codes', () => {
  it('parses W result code (unrated win)', () => {
    const input = `### trf26\n012 T\nXXR 1\n${playerLineWithResult('W')}\n`;
    expect(parse(input)?.players[0]?.results[0]?.result).toBe('W');
  });

  it('parses D result code (unrated draw)', () => {
    const input = `### trf26\n012 T\nXXR 1\n${playerLineWithResult('D')}\n`;
    expect(parse(input)?.players[0]?.results[0]?.result).toBe('D');
  });

  it('parses L result code (unrated loss)', () => {
    const input = `### trf26\n012 T\nXXR 1\n${playerLineWithResult('L')}\n`;
    expect(parse(input)?.players[0]?.results[0]?.result).toBe('L');
  });

  it('still emits onWarning for truly unknown result codes', () => {
    const onWarning = vi.fn();
    const input = `012 T\nXXR 1\n${playerLineWithResult('Q')}\n`;
    parse(input, { onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
  });

  it('W/D/L result codes do not emit onWarning', () => {
    const onWarning = vi.fn();
    const input = `### trf26\n012 T\nXXR 1\n${playerLineWithResult('W')}\n`;
    parse(input, { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// TRF26 tag parsing
// ---------------------------------------------------------------------------
describe('parse — TRF26 tags', () => {
  it('parses rounds from 142 tag', () => {
    expect(parse('### trf26\n012 T\n142 11\n')?.rounds).toBe(11);
  });

  it('parses initialColour W from 152 tag', () => {
    expect(parse('### trf26\n012 T\n152 W\nXXR 1\n')?.initialColour).toBe('W');
  });

  it('parses initialColour B from 152 tag', () => {
    expect(parse('### trf26\n012 T\n152 B\nXXR 1\n')?.initialColour).toBe('B');
  });

  it('ignores invalid 152 value', () => {
    expect(
      parse('### trf26\n012 T\n152 X\nXXR 1\n')?.initialColour,
    ).toBeUndefined();
  });

  it('parses pairingController from 182 tag', () => {
    expect(
      parse('### trf26\n012 T\n182 bbpPairings\nXXR 1\n')?.pairingController,
    ).toBe('bbpPairings');
  });
});

// ---------------------------------------------------------------------------
// Team records (310 and legacy 013)
// ---------------------------------------------------------------------------
describe('parse — team records (310)', () => {
  const TEAM_INPUT =
    [
      '### trf26',
      '012 T',
      'XXR 2',
      '310   1 India                            IND     2486   15.0   28.0  11     1    5   15   28   44',
      '310   2 Ukraine                          UKR     2478   14.0   26.5  14     2    4   20   27   22',
    ].join('\n') + '\n';

  it('parses teams array with correct length', () => {
    expect(parse(TEAM_INPUT)?.teams).toHaveLength(2);
  });

  it('parses team pairingNumber', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.pairingNumber).toBe(1);
  });

  it('parses team name', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.name).toBe('India');
  });

  it('parses team nickname', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.nickname).toBe('IND');
  });

  it('parses team matchPoints', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.matchPoints).toBe(15);
  });

  it('parses team gamePoints', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.gamePoints).toBe(28);
  });

  it('parses team rank', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.rank).toBe(11);
  });

  it('parses team playerIds', () => {
    expect(parse(TEAM_INPUT)?.teams?.[0]?.playerIds).toEqual([
      1, 5, 15, 28, 44,
    ]);
  });
});

describe('parse — legacy team records (013)', () => {
  const LEGACY_INPUT =
    [
      '012 T',
      'XXR 2',
      '013 India                            0001 0005 0015',
    ].join('\n') + '\n';

  it('parses legacy 013 records without error', () => {
    const result = parse(LEGACY_INPUT);
    expect(result).not.toBeNull();
  });

  it('does not emit onWarning for 013 records', () => {
    const onWarning = vi.fn();
    parse(LEGACY_INPUT, { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });
});

function teamTournament(): Tournament {
  return {
    players: [],
    rounds: 2,
    teams: [
      {
        gamePoints: 28,
        matchPoints: 15,
        name: 'India',
        nickname: 'IND',
        pairingNumber: 1,
        playerIds: [1, 5, 15, 28, 44],
        rank: 11,
      },
    ],
    version: 'TRF26' as const,
  };
}

describe('stringify — team records', () => {
  it('emits 310 records for TRF26', () => {
    expect(stringify(teamTournament())).toMatch(/^310/m);
  });

  it('does not emit 310 records for TRF16', () => {
    const t = { ...teamTournament(), version: 'TRF16' as const };
    expect(stringify(t)).not.toMatch(/^310/m);
  });

  it('stringified 310 line contains team name', () => {
    expect(stringify(teamTournament())).toContain('India');
  });

  it('stringified 310 line contains team rank', () => {
    expect(stringify(teamTournament())).toMatch(/310.*11/);
  });
});

// ---------------------------------------------------------------------------
// TRF26 stringify features
// ---------------------------------------------------------------------------
describe('stringify — TRF26 features', () => {
  it('emits ### comments before other tags when version is TRF26', () => {
    const t: Tournament = {
      comments: ['hello'],
      name: 'T',
      players: [],
      rounds: 1,
      version: 'TRF26',
    };
    const lines = stringify(t).split('\n');
    expect(lines[0]).toBe('### hello');
    expect(lines[1]).toBe('012 T');
  });

  it('does not emit ### comments for TRF16', () => {
    const t: Tournament = {
      comments: ['hello'],
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).not.toContain('###');
  });

  it('emits 142 in addition to XXR when version is TRF26', () => {
    const t: Tournament = { players: [], rounds: 9, version: 'TRF26' };
    const out = stringify(t);
    expect(out).toContain('142 9');
    expect(out).toContain('XXR 9');
  });

  it('does not emit 142 for TRF16', () => {
    const t: Tournament = { players: [], rounds: 9, version: 'TRF16' };
    expect(stringify(t)).not.toContain('142');
  });

  it('emits 152 initialColour when version is TRF26', () => {
    const t: Tournament = {
      initialColour: 'W',
      players: [],
      rounds: 1,
      version: 'TRF26',
    };
    expect(stringify(t)).toContain('152 W');
  });

  it('does not emit 152 for TRF16', () => {
    const t: Tournament = {
      initialColour: 'W',
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).not.toContain('152');
  });

  it('emits 182 pairingController when version is TRF26', () => {
    const t: Tournament = {
      pairingController: 'bbpPairings',
      players: [],
      rounds: 1,
      version: 'TRF26',
    };
    expect(stringify(t)).toContain('182 bbpPairings');
  });

  it('does not emit 182 for TRF16', () => {
    const t: Tournament = {
      pairingController: 'bbpPairings',
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).not.toContain('182');
  });

  it('emits 152 B when initialColour is B', () => {
    const t: Tournament = {
      initialColour: 'B',
      players: [],
      rounds: 1,
      version: 'TRF26',
    };
    expect(stringify(t)).toContain('152 B');
  });
});

// ---------------------------------------------------------------------------
// Bye records (240)
// ---------------------------------------------------------------------------
describe('parse — bye records (240)', () => {
  const BYE_INPUT = '### trf26\n012 T\nXXR 3\n240 H 003  026  047\n';

  it('parses bye record into byes array', () => {
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

  it('parses firstRound', () => {
    expect(parse(PP_INPUT)?.prohibitedPairings?.[0]?.firstRound).toBe(1);
  });

  it('parses lastRound', () => {
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

  it('parses gamePoints', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.gamePoints).toBe(2);
  });

  it('parses firstRound', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.firstRound).toBe(1);
  });

  it('parses lastRound', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.lastRound).toBe(3);
  });

  it('parses firstPlayerId', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.firstPlayerId).toBe(1);
  });

  it('parses lastPlayerId', () => {
    expect(parse(ACC_INPUT)?.acceleratedRounds?.[0]?.lastPlayerId).toBe(90);
  });
});

describe('parse — forfeited matches (330)', () => {
  const FM_INPUT = '### trf26\n012 T\nXXR 4\n330 +- 004 023 047\n';

  it('parses forfeited match record', () => {
    expect(parse(FM_INPUT)?.forfeitedMatches).toHaveLength(1);
  });

  it('parses forfeit type', () => {
    expect(parse(FM_INPUT)?.forfeitedMatches?.[0]?.type).toBe('+-');
  });

  it('parses round', () => {
    expect(parse(FM_INPUT)?.forfeitedMatches?.[0]?.round).toBe(4);
  });

  it('parses whiteTeamId', () => {
    expect(parse(FM_INPUT)?.forfeitedMatches?.[0]?.whiteTeamId).toBe(23);
  });

  it('parses blackTeamId', () => {
    expect(parse(FM_INPUT)?.forfeitedMatches?.[0]?.blackTeamId).toBe(47);
  });
});

describe('parse — out-of-order lineups (300)', () => {
  const OOO_INPUT =
    '### trf26\n012 T\nXXR 8\n300 008 021 047 0058 0203 0105 0162\n';

  it('parses out-of-order lineup record', () => {
    expect(parse(OOO_INPUT)?.outOfOrderLineups).toHaveLength(1);
  });

  it('parses round', () => {
    expect(parse(OOO_INPUT)?.outOfOrderLineups?.[0]?.round).toBe(8);
  });

  it('parses teamId', () => {
    expect(parse(OOO_INPUT)?.outOfOrderLineups?.[0]?.teamId).toBe(21);
  });

  it('parses opponentTeamId', () => {
    expect(parse(OOO_INPUT)?.outOfOrderLineups?.[0]?.opponentTeamId).toBe(47);
  });

  it('parses playerIds including null for unoccupied', () => {
    expect(parse(OOO_INPUT)?.outOfOrderLineups?.[0]?.playerIds).toEqual([
      58, 203, 105, 162,
    ]);
  });
});

describe('parse — team PAB (320)', () => {
  const PAB_INPUT = '### trf26\n012 T\nXXR 4\n320 01.0 02.0 000 000 050 049\n';

  it('parses team PAB record', () => {
    expect(parse(PAB_INPUT)?.teamPairingAllocatedByes).toBeDefined();
  });

  it('parses matchPoints', () => {
    expect(parse(PAB_INPUT)?.teamPairingAllocatedByes?.matchPoints).toBe(1);
  });

  it('parses gamePoints', () => {
    expect(parse(PAB_INPUT)?.teamPairingAllocatedByes?.gamePoints).toBe(2);
  });

  it('parses teamIdPerRound with null for 000', () => {
    expect(parse(PAB_INPUT)?.teamPairingAllocatedByes?.teamIdPerRound).toEqual([
      // eslint-disable-next-line unicorn/no-null
      null,
      // eslint-disable-next-line unicorn/no-null
      null,
      50,
      49,
    ]);
  });
});

describe('parse — abnormal points (299)', () => {
  const ABN_INPUT = '### trf26\n012 T\nXXR 2\n299 +   2.0   2.5\n';

  it('parses abnormal points record', () => {
    expect(parse(ABN_INPUT)?.abnormalPoints).toHaveLength(1);
  });

  it('parses type', () => {
    expect(parse(ABN_INPUT)?.abnormalPoints?.[0]?.type).toBe('+');
  });

  it('parses matchPoints', () => {
    expect(parse(ABN_INPUT)?.abnormalPoints?.[0]?.matchPoints).toBe(2);
  });

  it('parses gamePoints', () => {
    expect(parse(ABN_INPUT)?.abnormalPoints?.[0]?.gamePoints).toBe(2.5);
  });
});

describe('stringify — bye records (240)', () => {
  it('emits 240 records for TRF26', () => {
    const t: Tournament = {
      byes: [{ playerIds: [26, 47], round: 3, type: 'H' }],
      players: [],
      rounds: 3,
      version: 'TRF26',
    };
    expect(stringify(t)).toMatch(/^240/m);
  });

  it('does not emit 240 for TRF16', () => {
    const t: Tournament = {
      byes: [{ playerIds: [26], round: 1, type: 'H' }],
      players: [],
      rounds: 1,
      version: 'TRF16',
    };
    expect(stringify(t)).not.toMatch(/^240/m);
  });
});

describe('stringify — prohibited pairings (260)', () => {
  it('emits 260 records for TRF26', () => {
    const t: Tournament = {
      players: [],
      prohibitedPairings: [
        { firstRound: 1, lastRound: 2, playerIds: [125, 180] },
      ],
      rounds: 2,
      version: 'TRF26',
    };
    expect(stringify(t)).toMatch(/^260/m);
  });
});

describe('stringify — accelerated rounds (250)', () => {
  it('emits 250 records for TRF26', () => {
    const t: Tournament = {
      acceleratedRounds: [
        {
          firstPlayerId: 1,
          firstRound: 1,
          gamePoints: 2,
          lastPlayerId: 90,
          lastRound: 3,
          matchPoints: 0,
        },
      ],
      players: [],
      rounds: 9,
      version: 'TRF26',
    };
    expect(stringify(t)).toMatch(/^250/m);
  });
});

describe('stringify — forfeited matches (330)', () => {
  it('emits 330 records for TRF26', () => {
    const t: Tournament = {
      forfeitedMatches: [
        { blackTeamId: 47, round: 4, type: '+-', whiteTeamId: 23 },
      ],
      players: [],
      rounds: 4,
      version: 'TRF26',
    };
    expect(stringify(t)).toMatch(/^330/m);
  });
});
