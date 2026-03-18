import {
  COL_BIRTH_DATE,
  COL_FEDERATION,
  COL_FIDE_ID,
  COL_NAME,
  COL_PAIRING_NUMBER,
  COL_POINTS,
  COL_RANK,
  COL_RATING,
  COL_SEX,
  COL_TITLE,
  ROUND_ENTRY_LENGTH,
  ROUND_RESULTS_OFFSET,
} from './columns.js';

import type { Player, StringifyOptions, Tournament } from './types.js';

function pad(value: string, length: number, align: 'left' | 'right'): string {
  return align === 'right' ? value.padStart(length) : value.padEnd(length);
}

function writeAt(buf: string[], col: number, value: string): void {
  for (const [index, char] of [...value].entries()) {
    buf[col + index] = char;
  }
}

function stringifyPlayerLine(
  player: Player,
  playerIndex: number,
  onWarning?: StringifyOptions['onWarning'],
): string {
  function warnIfTruncated(
    value: string,
    field: string,
    max: number,
    col: number,
  ): void {
    if (value.length > max) {
      onWarning?.({
        column: col + 1,
        line: playerIndex + 1,
        message: `Player ${playerIndex + 1}: ${field} exceeds ${max} characters and will be truncated`,
        offset: 0,
      });
    }
  }

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
  warnIfTruncated(player.name, 'name', 33, COL_NAME);
  writeAt(buf, COL_NAME, pad(player.name.slice(0, 33), 33, 'left'));

  // Rating — right-aligned in 4 chars at col 48
  if (player.rating !== undefined) {
    writeAt(buf, COL_RATING, pad(String(player.rating), 4, 'right'));
  }

  // Federation — left-aligned in 3 chars at col 53
  if (player.federation !== undefined) {
    warnIfTruncated(player.federation, 'federation', 3, COL_FEDERATION);
    writeAt(buf, COL_FEDERATION, pad(player.federation.slice(0, 3), 3, 'left'));
  }

  // FIDE ID — left-aligned in 12 chars at col 57
  if (player.fideId !== undefined) {
    warnIfTruncated(player.fideId, 'fideId', 12, COL_FIDE_ID);
    writeAt(buf, COL_FIDE_ID, pad(player.fideId.slice(0, 12), 12, 'left'));
  }

  // Birth date — left-aligned in 10 chars at col 70
  if (player.birthDate !== undefined) {
    warnIfTruncated(player.birthDate, 'birthDate', 10, COL_BIRTH_DATE);
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

export default function stringify(
  tournament: Tournament,
  options?: StringifyOptions,
): string {
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
  if (tournament.numberOfPlayers !== undefined) {
    lines.push(`062 ${tournament.numberOfPlayers}`);
  }
  if (tournament.numberOfRatedPlayers !== undefined) {
    lines.push(`072 ${tournament.numberOfRatedPlayers}`);
  }
  if (tournament.numberOfTeams !== undefined) {
    lines.push(`082 ${tournament.numberOfTeams}`);
  }
  if (tournament.tournamentType !== undefined) {
    lines.push(`092 ${tournament.tournamentType}`);
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
  if (tournament.rounds > 0) {
    lines.push(`XXR ${tournament.rounds}`);
  }

  for (const [index, player] of tournament.players.entries()) {
    lines.push(stringifyPlayerLine(player, index, options?.onWarning));
  }

  return lines.join('\n');
}
