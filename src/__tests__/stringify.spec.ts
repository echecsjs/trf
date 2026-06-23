import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { parse, stringify } from '../index.js';

import type {
  ParseWarning,
  Player,
  ScoringSystem,
  StringifyOptions,
  TournamentData,
} from '../types.js';

function minimal(overrides: Partial<TournamentData> = {}): TournamentData {
  return {
    completedRounds: [],
    players: [],
    totalRounds: 0,
    ...overrides,
  };
}

describe('stringify — header tags', () => {
  it('emits XXR line for rounds', () => {
    expect(stringify(minimal({ totalRounds: 9 }))).toContain('XXR 9');
  });

  it('emits 012 line for name', () => {
    expect(
      stringify(minimal({ metadata: { name: 'Open Championship' } })),
    ).toContain('012 Open Championship');
  });

  it('emits 022 line for city', () => {
    expect(stringify(minimal({ metadata: { city: 'Paris' } }))).toContain(
      '022 Paris',
    );
  });

  it('emits 032 line for federation', () => {
    expect(stringify(minimal({ metadata: { federation: 'FRA' } }))).toContain(
      '032 FRA',
    );
  });

  it('emits 042 line for startDate', () => {
    expect(
      stringify(minimal({ metadata: { startDate: '2026-01-01' } })),
    ).toContain('042 2026-01-01');
  });

  it('emits 052 line for endDate', () => {
    expect(
      stringify(minimal({ metadata: { endDate: '2026-01-07' } })),
    ).toContain('052 2026-01-07');
  });

  it('emits 102 line for chiefArbiter', () => {
    expect(
      stringify(minimal({ metadata: { chiefArbiter: 'Smith John' } })),
    ).toContain('102 Smith John');
  });

  it('emits 122 line for timeControl', () => {
    expect(
      stringify(minimal({ metadata: { timeControl: '90+30' } })),
    ).toContain('122 90+30');
  });

  it('omits 012 line when name is absent', () => {
    expect(stringify(minimal())).not.toContain('012');
  });

  it('omits XXR line when rounds is 0', () => {
    expect(stringify(minimal({ totalRounds: 0 }))).not.toContain('XXR');
  });
});

describe('stringify — XXC (TRFx configuration)', () => {
  it('emits XXC rank for TRF16 when useRankingId is true in options', () => {
    expect(stringify(minimal(), { useRankingId: true })).toContain('XXC rank');
  });

  it('does not emit XXC when useRankingId is not in options', () => {
    expect(stringify(minimal())).not.toContain('XXC');
  });
});

describe('stringify — XXZ (absent players)', () => {
  it('does not emit XXZ (withdrawnPlayers not yet on TournamentData)', () => {
    expect(stringify(minimal())).not.toContain('XXZ');
  });
});

describe('stringify — XXA (per-player acceleration points)', () => {
  it('emits XXA line for each player acceleration', () => {
    const output = stringify(
      minimal({
        playerAccelerations: [{ playerId: '1', points: [0.5, 0.5, 0] }],
      }),
    );
    expect(output).toMatch(/XXA\s+1\s+0\.5\s+0\.5\s+0\.0/);
  });

  it('does not emit XXA when playerAccelerations is undefined', () => {
    expect(stringify(minimal())).not.toContain('XXA');
  });
});

function minimalPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: '1',
    name: 'Test Player',
    points: 0,
    rank: 1,
    startingRank: 1,
    ...overrides,
  };
}

describe('stringify — player lines', () => {
  it('emits a 001 line for each player', () => {
    const t = minimal({
      players: [
        minimalPlayer(),
        minimalPlayer({ id: '2', name: 'Other', startingRank: 2 }),
      ],
    });
    const lines = stringify(t)
      .split('\n')
      .filter((l) => l.startsWith('001'));
    expect(lines).toHaveLength(2);
  });

  it('writes pairing number right-aligned in cols 4-7', () => {
    const line = stringify(minimal({ players: [minimalPlayer()] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(4, 8)).toBe('   1');
  });

  it('writes sex at col 9', () => {
    const line = stringify(minimal({ players: [minimalPlayer({ sex: 'm' })] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.at(9)).toBe('m');
  });

  it('writes blank at col 9 when sex is absent', () => {
    const line = stringify(minimal({ players: [minimalPlayer()] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.at(9)).toBe(' ');
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
      minimal({
        players: [minimalPlayer({ name: 'Kasparov, Garry' })],
      }),
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
    expect(line.slice(57, 69).trimEnd()).toBe('4100018363');
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
    // White player (id=1) beats black (id=2), rated game, round 1
    const t = minimal({
      completedRounds: [
        {
          byes: [],
          games: [{ black: '2', rated: true, result: 'white', white: '1' }],
        },
      ],
      players: [minimalPlayer()],
    });
    const line = stringify(t)
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(91, 101)).toBe('   2 w 1  ');
  });

  it('writes 0000 for null opponentId (bye)', () => {
    const t = minimal({
      completedRounds: [
        {
          byes: [{ kind: 'zero', player: '1' }],
          games: [],
        },
      ],
      players: [minimalPlayer()],
    });
    const line = stringify(t)
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(91, 101)).toBe('0000 - Z  ');
  });

  it('writes second round result at col 101', () => {
    // Round 1: player 1 (white) beats player 2; Round 2: player 3 (white) beats player 1
    const t = minimal({
      completedRounds: [
        {
          byes: [],
          games: [{ black: '2', rated: true, result: 'white', white: '1' }],
        },
        {
          byes: [],
          games: [{ black: '1', rated: true, result: 'white', white: '3' }],
        },
      ],
      players: [minimalPlayer()],
    });
    const line = stringify(t)
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(101, 111)).toBe('   3 b 0  ');
  });

  it('writes no round columns when completedRounds is empty', () => {
    const line = stringify(minimal({ players: [minimalPlayer()] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.length).toBe(89);
  });
});

describe('stringify — onWarning', () => {
  it('accepts a StringifyOptions object without throwing', () => {
    const options: StringifyOptions = { onWarning: vi.fn() };
    expect(() => stringify(minimal(), options)).not.toThrow();
  });

  it('calls onWarning when name exceeds 33 characters', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ name: 'A'.repeat(34) });
    stringify(minimal({ players: [player] }), { onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
  });

  it('does not call onWarning when name is exactly 33 characters', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ name: 'A'.repeat(33) });
    stringify(minimal({ players: [player] }), { onWarning });
    expect(onWarning).not.toHaveBeenCalled();
  });

  it('calls onWarning when federation exceeds 3 characters', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ federation: 'FRAN' });
    stringify(minimal({ players: [player] }), { onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
  });

  it('calls onWarning when fideId exceeds 12 characters', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ fideId: '1234567890123' });
    stringify(minimal({ players: [player] }), { onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
  });

  it('calls onWarning when birthDate exceeds 10 characters', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ birthDate: '1963-04-13X' });
    stringify(minimal({ players: [player] }), { onWarning });
    expect(onWarning).toHaveBeenCalledOnce();
  });

  it('still produces truncated output when onWarning fires', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ name: 'A'.repeat(34) });
    const result = stringify(minimal({ players: [player] }), { onWarning });
    const line = result.split('\n').find((l) => l.startsWith('001'))!;
    expect(line.slice(14, 47)).toBe('A'.repeat(33));
  });

  it('warning message includes field name and limit', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ name: 'A'.repeat(34) });
    stringify(minimal({ players: [player] }), { onWarning });
    const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
    expect(warn.message).toMatch(/name/i);
    expect(warn.message).toMatch(/33/);
  });

  it('warning line equals 1-based player index', () => {
    const onWarning = vi.fn();
    const players = [
      minimalPlayer({ id: '1', startingRank: 1 }),
      minimalPlayer({ id: '2', name: 'A'.repeat(34), startingRank: 2 }),
    ];
    stringify(minimal({ players }), { onWarning });
    const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
    expect(warn.line).toBe(2);
  });

  it('warning column equals 1-based column offset of the field', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ name: 'A'.repeat(34) });
    stringify(minimal({ players: [player] }), { onWarning });
    const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
    expect(warn.column).toBe(15); // COL_NAME + 1 = 14 + 1
  });

  it('warning offset is 0', () => {
    const onWarning = vi.fn();
    const player = minimalPlayer({ name: 'A'.repeat(34) });
    stringify(minimal({ players: [player] }), { onWarning });
    const warn = onWarning.mock.calls[0]?.[0] as ParseWarning;
    expect(warn.offset).toBe(0);
  });

  it('does not warn when options is omitted', () => {
    const player = minimalPlayer({ name: 'A'.repeat(34) });
    expect(() => stringify(minimal({ players: [player] }))).not.toThrow();
  });
});

function fixture(name: string): string {
  return readFileSync(
    path.join(import.meta.dirname, 'fixtures', `${name}.trf`),
    'utf8',
  );
}

describe('stringify — tag 192 (encoded tournament type)', () => {
  it('emits 192 line for encodedTournamentType in options', () => {
    const output = stringify(minimal(), {
      encodedTournamentType: 'FIDE_DUTCH_2025',
      version: 'TRF26',
    });
    expect(output).toContain('192 FIDE_DUTCH_2025');
  });

  it('omits 192 line when encodedTournamentType is not in options', () => {
    const output = stringify(minimal(), { version: 'TRF26' });
    expect(output).not.toContain('192');
  });
});

describe('stringify — tag 162 (scoring system)', () => {
  it('emits 162 line with non-default win value', () => {
    const output = stringify(
      minimal({
        scoringSystem: { win: 3 },
      }),
      { version: 'TRF26' },
    );
    expect(output).toContain('162');
    expect(output).toMatch(/162\s+W\s+3\.0/);
  });

  it('emits all six codes when all are set', () => {
    const scoring: ScoringSystem = {
      absence: 0,
      draw: 1,
      loss: 0,
      pairingAllocatedBye: 3,
      unknown: 1,
      win: 3,
    };
    const output = stringify(minimal({ scoringSystem: scoring }), {
      version: 'TRF26',
    });
    expect(output).toMatch(/162/);
    // All codes should appear
    expect(output).toMatch(/W\s+3\.0/);
    expect(output).toMatch(/D\s+1\.0/);
    expect(output).toMatch(/L\s+0\.0/);
    expect(output).toMatch(/A\s+0\.0/);
    expect(output).toMatch(/P\s+3\.0/);
    expect(output).toMatch(/X\s+1\.0/);
  });

  it('omits 162 line when scoringSystem is undefined', () => {
    const output = stringify(minimal(), { version: 'TRF26' });
    expect(output).not.toContain('162');
  });

  it('omits 162 line when scoringSystem is empty object', () => {
    const output = stringify(minimal({ scoringSystem: {} }), {
      version: 'TRF26',
    });
    expect(output).not.toContain('162');
  });
});

// ---------------------------------------------------------------------------
// XXS — Extended Scoring System
// ---------------------------------------------------------------------------
describe('stringify — XXS (extended scoring system)', () => {
  it('emits XXS for colour-specific scoring fields', () => {
    const output = stringify(
      minimal({ scoringSystem: { blackWin: 1, whiteWin: 1.5 } }),
    );
    expect(output).toMatch(/XXS/);
    expect(output).toContain('WW=1.5');
    expect(output).toContain('BW=1.0');
  });

  it('does not emit XXS when only tag-162 fields are set', () => {
    const output = stringify(minimal({ scoringSystem: { win: 3 } }), {
      version: 'TRF26',
    });
    expect(output).not.toContain('XXS');
  });
});

// ---------------------------------------------------------------------------
// XXP — Forbidden pairs
// ---------------------------------------------------------------------------
describe('stringify — XXP (forbidden pairs)', () => {
  it('emits XXP for prohibited pairings with round 0/0', () => {
    const output = stringify(
      minimal({
        prohibitedPairings: [
          { firstRound: 0, lastRound: 0, playerIds: ['13', '68'] },
        ],
      }),
    );
    expect(output).toContain('XXP 13 68');
  });

  it('does not emit XXP for tag 260 pairings (non-zero rounds)', () => {
    const output = stringify(
      minimal({
        prohibitedPairings: [
          { firstRound: 1, lastRound: 3, playerIds: ['13', '68'] },
        ],
      }),
    );
    expect(output).not.toContain('XXP');
  });
});

const ROUNDTRIP_FIXTURES = [
  'dutch_2025_C5',
  'dutch_2025_C9',
  'grandmommyscup',
  'issue_7',
  'issue_15',
  'javafo_sample2',
];

describe('stringify — roundtrip', () => {
  for (const name of ROUNDTRIP_FIXTURES) {
    it(`parse → stringify → parse is stable for ${name}`, () => {
      const t1 = parse(fixture(name))!;
      // Detect version for fixture to pass to stringify
      const isT26 = name === 'grandmommyscup';
      const t2 = parse(
        stringify(t1, isT26 ? { version: 'TRF26' } : undefined),
      )!;
      expect(t2.metadata?.name).toBe(t1.metadata?.name);
      expect(t2.totalRounds).toBe(t1.totalRounds);
      expect(t2.players).toHaveLength(t1.players.length);
      for (const [index, p1] of t1.players.entries()) {
        const p2 = t2.players[index]!;
        expect(p2.id).toBe(p1.id);
        expect(p2.name).toBe(p1.name);
        expect(p2.rating).toBe(p1.rating);
        expect(p2.points).toBe(p1.points);
        expect(p2.rank).toBe(p1.rank);
        expect(p2.sex).toBe(p1.sex);
        expect(p2.title).toBe(p1.title);
        expect(p2.federation).toBe(p1.federation);
        expect(p2.fideId).toBe(p1.fideId);
        expect(p2.birthDate).toBe(p1.birthDate);
      }
      // Verify completedRounds have stable game/bye counts
      expect(t2.completedRounds).toHaveLength(t1.completedRounds.length);
      for (const [index, r1] of t1.completedRounds.entries()) {
        const r2 = t2.completedRounds[index]!;
        expect(r2.games).toHaveLength(r1.games.length);
        expect(r2.byes).toHaveLength(r1.byes.length);
      }
    });
  }
});
