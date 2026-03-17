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
  for (const [index, char] of [...value].entries()) {
    buf[col + index] = char;
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
  const pointsString = player.points.toFixed(1);
  writeAt(buf, COL_POINTS, pad(pointsString, 4, 'right'));

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
      const opponentString =
        result.opponentId === null
          ? '0000'
          : String(result.opponentId).padStart(4, ' ');
      const entry = `${opponentString} ${result.color} ${result.result}  `;
      writeAt(buf, slot, entry);
    }
    // Trim trailing spaces only up to the rounds section; keep round entries intact
    const header = buf.slice(0, ROUND_RESULTS_OFFSET).join('').trimEnd();
    const rounds = buf.slice(ROUND_RESULTS_OFFSET).join('');
    return header + ' '.repeat(ROUND_RESULTS_OFFSET - header.length) + rounds;
  }

  return buf.join('').trimEnd();
}

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

  for (const player of tournament.players) {
    lines.push(stringifyPlayerLine(player));
  }

  return lines.join('\n');
}
