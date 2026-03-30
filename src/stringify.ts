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

  if (tournament.version === 'TRF26') {
    for (const comment of tournament.comments ?? []) {
      lines.push(`### ${comment}`);
    }
  }

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
  if (tournament.roundDates !== undefined && tournament.roundDates.length > 0) {
    // Round dates occupy 10-char slots starting at col 91 (same as 001 round results).
    const buf: string[] = Array.from(
      { length: ROUND_RESULTS_OFFSET },
      () => ' ',
    );
    buf[0] = '1';
    buf[1] = '3';
    buf[2] = '2';
    for (const [index, date] of tournament.roundDates.entries()) {
      const pos = ROUND_RESULTS_OFFSET + index * ROUND_ENTRY_LENGTH;
      while (buf.length < pos + ROUND_ENTRY_LENGTH) {
        buf.push(' ');
      }
      writeAt(buf, pos, date.slice(0, 8));
    }
    lines.push(buf.join('').trimEnd());
  }
  if (tournament.rounds > 0) {
    lines.push(`XXR ${tournament.rounds}`);
  }

  if (
    tournament.absentPlayers !== undefined &&
    tournament.absentPlayers.length > 0
  ) {
    lines.push(`XXZ ${tournament.absentPlayers.join(' ')}`);
  }

  for (const pa of tournament.playerAccelerations ?? []) {
    const pointsPart = pa.points
      .map((p) => pad(p.toFixed(1), 4, 'right'))
      .join(' ');
    lines.push(`XXA${pad(String(pa.pairingNumber), 4, 'right')} ${pointsPart}`);
  }

  {
    const xxcParts: string[] = [];
    if (tournament.useRankingId === true) {
      xxcParts.push('rank');
    }
    if (
      tournament.version !== 'TRF26' &&
      tournament.initialColour !== undefined
    ) {
      xxcParts.push(tournament.initialColour === 'W' ? 'white1' : 'black1');
    }
    if (xxcParts.length > 0) {
      lines.push(`XXC ${xxcParts.join(' ')}`);
    }
  }

  {
    const s = tournament.scoringSystem;
    if (s !== undefined) {
      const xxsColourCodes: [string, number | undefined][] = [
        ['WW', s.whiteWin],
        ['BW', s.blackWin],
        ['WD', s.whiteDraw],
        ['BD', s.blackDraw],
        ['WL', s.whiteLoss],
        ['BL', s.blackLoss],
        ['ZPB', s.zeroPointBye],
        ['HPB', s.halfPointBye],
        ['FPB', s.fullPointBye],
        ['FW', s.forfeitWin],
        ['FL', s.forfeitLoss],
      ];
      const xxsColourEntries = xxsColourCodes.filter(
        (c): c is [string, number] => c[1] !== undefined,
      );
      if (xxsColourEntries.length > 0) {
        const allEntries: [string, number][] = [...xxsColourEntries];
        if (s.pairingAllocatedBye !== undefined) {
          allEntries.push(['PAB', s.pairingAllocatedBye]);
        }
        const parts = allEntries.map(
          ([code, pts]) => `${code}=${pts.toFixed(1)}`,
        );
        lines.push(`XXS ${parts.join(' ')}`);
      }
    }
  }

  if (tournament.version === 'TRF26') {
    if (tournament.rounds > 0) {
      lines.push(`142 ${tournament.rounds}`);
    }
    if (tournament.initialColour !== undefined) {
      lines.push(`152 ${tournament.initialColour}`);
    }
    if (tournament.scoringSystem !== undefined) {
      const s = tournament.scoringSystem;
      const codes: [string, number | undefined][] = [
        ['W', s.win],
        ['D', s.draw],
        ['L', s.loss],
        ['A', s.absence],
        ['P', s.pairingAllocatedBye],
        ['X', s.unknown],
      ];
      const entries = codes
        .filter((c): c is [string, number] => c[1] !== undefined)
        .map(([code, pts]) => `${code}${pad(pts.toFixed(1), 4, 'right')}`);
      if (entries.length > 0) {
        lines.push(`162  ${entries.join('    ')}`);
      }
    }
    if (tournament.startingRankMethod !== undefined) {
      lines.push(`172 ${tournament.startingRankMethod}`);
    }
    if (tournament.pairingController !== undefined) {
      lines.push(`182 ${tournament.pairingController}`);
    }
    if (tournament.encodedTournamentType !== undefined) {
      lines.push(`192 ${tournament.encodedTournamentType}`);
    }
    if (tournament.tiebreaks !== undefined && tournament.tiebreaks.length > 0) {
      lines.push(`202 ${tournament.tiebreaks.join(',')}`);
    }
    if (
      tournament.standingsTiebreaks !== undefined &&
      tournament.standingsTiebreaks.length > 0
    ) {
      lines.push(`212 ${tournament.standingsTiebreaks.join(',')}`);
    }
    if (tournament.encodedTimeControl !== undefined) {
      lines.push(`222 ${tournament.encodedTimeControl}`);
    }
    if (tournament.colourSequence !== undefined) {
      lines.push(`352 ${tournament.colourSequence}`);
    }
    if (tournament.teamScoringSystem !== undefined) {
      lines.push(`362 ${tournament.teamScoringSystem}`);
    }
  }

  for (const [index, player] of tournament.players.entries()) {
    lines.push(stringifyPlayerLine(player, index, options?.onWarning));
  }

  // NRS records — emitted after all 001 records, TRF26 only
  if (tournament.version === 'TRF26') {
    for (const player of tournament.players) {
      for (const nrs of player.nationalRatings ?? []) {
        const buf: string[] = Array.from({ length: COL_RANK + 5 }, () => ' ');
        // Federation code as record type (3 chars)
        writeAt(buf, 0, nrs.federation.slice(0, 3));
        writeAt(
          buf,
          COL_PAIRING_NUMBER,
          pad(String(nrs.pairingNumber), 4, 'right'),
        );
        if (nrs.sex !== undefined) {
          buf[COL_SEX] = nrs.sex;
        }
        if (nrs.classification !== undefined) {
          writeAt(
            buf,
            COL_TITLE,
            pad(nrs.classification.slice(0, 3), 3, 'left'),
          );
        }
        if (nrs.name !== undefined) {
          writeAt(buf, COL_NAME, pad(nrs.name.slice(0, 33), 33, 'left'));
        }
        writeAt(buf, COL_RATING, pad(String(nrs.rating), 4, 'right'));
        if (nrs.origin !== undefined) {
          writeAt(buf, COL_FEDERATION, pad(nrs.origin.slice(0, 3), 3, 'left'));
        }
        if (nrs.nationalId !== undefined) {
          writeAt(
            buf,
            COL_FIDE_ID,
            pad(nrs.nationalId.slice(0, 12), 12, 'left'),
          );
        }
        if (nrs.birthDate !== undefined) {
          writeAt(
            buf,
            COL_BIRTH_DATE,
            pad(nrs.birthDate.slice(0, 10), 10, 'left'),
          );
        }
        lines.push(buf.join('').trimEnd());
      }
    }
  }

  // 240 — Bye records (TRF26 only)
  if (tournament.version === 'TRF26') {
    for (const bye of tournament.byes ?? []) {
      const playerPart = bye.playerIds
        .map((id) => String(id).padStart(4))
        .join(' ');
      lines.push(
        `240 ${bye.type} ${String(bye.round).padStart(3)} ${playerPart}`,
      );
    }
  }

  // 250 — Accelerated rounds (TRF26 only)
  if (tournament.version === 'TRF26') {
    for (const accumulator of tournament.acceleratedRounds ?? []) {
      lines.push(
        `250 ${accumulator.matchPoints.toFixed(1).padStart(4)} ${accumulator.gamePoints.toFixed(1).padStart(4)} ${String(accumulator.firstRound).padStart(3)} ${String(accumulator.lastRound).padStart(3)} ${String(accumulator.firstPlayerId).padStart(4)} ${String(accumulator.lastPlayerId).padStart(4)}`,
      );
    }
  }

  // XXP — Forbidden pairs (all versions; round sentinel 0/0)
  for (const pp of tournament.prohibitedPairings ?? []) {
    if (pp.firstRound === 0 && pp.lastRound === 0) {
      const idPart = pp.playerIds.join(' ');
      lines.push(`XXP ${idPart}`);
    }
  }

  // 260 — Prohibited pairings (TRF26 only)
  if (tournament.version === 'TRF26') {
    for (const pp of tournament.prohibitedPairings ?? []) {
      if (pp.firstRound !== 0 || pp.lastRound !== 0) {
        const idPart = pp.playerIds
          .map((id) => String(id).padStart(4))
          .join(' ');
        lines.push(
          `260 ${String(pp.firstRound).padStart(3)} ${String(pp.lastRound).padStart(3)} ${idPart}`,
        );
      }
    }
  }

  // 299 — Abnormal points (TRF26 only)
  if (tournament.version === 'TRF26') {
    for (const ab of tournament.abnormalPoints ?? []) {
      const roundPart = ab.round === 0 ? '   ' : String(ab.round).padStart(3);
      const idPart =
        ab.playerIds.length === 0
          ? ''
          : ' ' + ab.playerIds.map((id) => String(id).padStart(4)).join(' ');
      lines.push(
        `299 ${ab.type}  ${ab.matchPoints.toFixed(1).padStart(4)}  ${ab.gamePoints.toFixed(1).padStart(4)}  ${roundPart}${idPart}`,
      );
    }
  }

  // 300 — Out-of-order lineups (TRF26 only)
  if (tournament.version === 'TRF26') {
    for (const ool of tournament.outOfOrderLineups ?? []) {
      const idPart = ool.playerIds
        .map((id) => (id === null ? '0000' : String(id).padStart(4)))
        .join(' ');
      lines.push(
        `300 ${String(ool.round).padStart(3)} ${String(ool.teamId).padStart(3)} ${String(ool.opponentTeamId).padStart(3)} ${idPart}`,
      );
    }
  }

  // 320 — Team PAB (TRF26 only)
  if (
    tournament.version === 'TRF26' &&
    tournament.teamPairingAllocatedByes !== undefined
  ) {
    const pab = tournament.teamPairingAllocatedByes;
    const roundParts = pab.teamIdPerRound
      .map((id) => (id === null ? '000' : String(id).padStart(3)))
      .join(' ');
    lines.push(
      `320 ${pab.matchPoints.toFixed(1).padStart(4)} ${pab.gamePoints.toFixed(1).padStart(4)} ${roundParts}`,
    );
  }

  // 330 — Forfeited matches (TRF26 only)
  if (tournament.version === 'TRF26') {
    for (const fm of tournament.forfeitedMatches ?? []) {
      lines.push(
        `330 ${fm.type} ${String(fm.round).padStart(3)} ${String(fm.whiteTeamId).padStart(3)} ${String(fm.blackTeamId).padStart(3)}`,
      );
    }
  }

  // Team records (310) — TRF26 only
  if (tournament.version === 'TRF26') {
    for (const team of tournament.teams ?? []) {
      const buf: string[] = Array.from({ length: 72 }, () => ' ');
      buf[0] = '3';
      buf[1] = '1';
      buf[2] = '0';
      writeAt(buf, 4, pad(String(team.pairingNumber), 3, 'right'));
      writeAt(buf, 8, pad(team.name.slice(0, 32), 32, 'left'));
      if (team.nickname !== undefined) {
        writeAt(buf, 41, pad(team.nickname.slice(0, 5), 5, 'left'));
      }
      if (team.strengthFactor !== undefined) {
        writeAt(
          buf,
          47,
          pad(String(team.strengthFactor).slice(0, 6), 6, 'left'),
        );
      }
      writeAt(buf, 54, pad(team.matchPoints.toFixed(1), 6, 'right'));
      writeAt(buf, 61, pad(team.gamePoints.toFixed(1), 6, 'right'));
      writeAt(buf, 68, pad(String(team.rank), 3, 'right'));
      for (const [index, id] of team.playerIds.entries()) {
        const pos = 73 + index * 5;
        while (buf.length < pos + 4) {
          buf.push(' ');
        }
        writeAt(buf, pos, pad(String(id), 4, 'right'));
      }
      lines.push(buf.join('').trimEnd());
    }
  }

  return lines.join('\n');
}
