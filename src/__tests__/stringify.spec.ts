import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { parse, stringify } from '../index.js';

import type { Player, Tournament } from '../types.js';

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
    const player = minimalPlayer({
      results: [{ color: 'w', opponentId: 2, result: '1', round: 1 }],
    });
    const line = stringify(minimal({ players: [player] }))
      .split('\n')
      .find((l) => l.startsWith('001'))!;
    expect(line.slice(91, 101)).toBe('   2 w 1  ');
  });

  it('writes 0000 for null opponentId (bye)', () => {
    const player = minimalPlayer({
      // eslint-disable-next-line unicorn/no-null
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
    expect(line.length).toBe(89);
  });
});

function fixture(name: string): string {
  return readFileSync(
    path.join(import.meta.dirname, 'fixtures', `${name}.trf`),
    'utf8',
  );
}

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
      const t2 = parse(stringify(t1))!;
      expect(t2.name).toBe(t1.name);
      expect(t2.rounds).toBe(t1.rounds);
      expect(t2.players).toHaveLength(t1.players.length);
      for (const [index, p1] of t1.players.entries()) {
        const p2 = t2.players[index]!;
        expect(p2.pairingNumber).toBe(p1.pairingNumber);
        expect(p2.name).toBe(p1.name);
        expect(p2.rating).toBe(p1.rating);
        expect(p2.points).toBe(p1.points);
        expect(p2.rank).toBe(p1.rank);
        expect(p2.sex).toBe(p1.sex);
        expect(p2.title).toBe(p1.title);
        expect(p2.federation).toBe(p1.federation);
        expect(p2.fideId).toBe(p1.fideId);
        expect(p2.birthDate).toBe(p1.birthDate);
        expect(p2.results).toHaveLength(p1.results.length);
        for (const [index, r1] of p1.results.entries()) {
          const r2 = p2.results[index]!;
          expect(r2.round).toBe(r1.round);
          expect(r2.color).toBe(r1.color);
          expect(r2.result).toBe(r1.result);
          expect(r2.opponentId).toBe(r1.opponentId);
        }
      }
    });
  }
});
