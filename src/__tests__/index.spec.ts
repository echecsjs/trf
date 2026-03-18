import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { parse } from '../index.js';

import type { ParseError, ParseWarning } from '../types.js';

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

  it('parses chief arbiter from 092 tag', () => {
    expect(parse('012 T\n092 Smith John\nXXR 1\n')?.chiefArbiter).toBe(
      'Smith John',
    );
  });

  it('parses time control from 112 tag', () => {
    expect(parse('012 T\n112 90+30\nXXR 1\n')?.timeControl).toBe('90+30');
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

  it('maps JaVaFo title "g" to GM for P1', () => {
    expect(parse(fixture('javafo_sample2'))?.players[0]?.title).toBe('GM');
  });

  it('maps JaVaFo title "m" to IM for P2', () => {
    expect(parse(fixture('javafo_sample2'))?.players[1]?.title).toBe('IM');
  });

  it('maps JaVaFo title "f" to FM for P3', () => {
    expect(parse(fixture('javafo_sample2'))?.players[2]?.title).toBe('FM');
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

  it('parses rounds from 142 (mapped as chief arbiter — unknown tag gracefully ignored)', () => {
    // The GrandMommysCup uses tag 142 for rounds instead of XXR.
    // Our parser does not recognise 142 as a rounds tag — rounds will be 0.
    // This is expected behaviour for TRF25-only tags.
    expect(parse(fixture('grandmommyscup'))?.rounds).toBe(0);
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
