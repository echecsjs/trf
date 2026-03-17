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
