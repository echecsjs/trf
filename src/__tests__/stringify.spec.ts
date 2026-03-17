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
