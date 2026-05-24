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

import type {
  Player,
  StringifyOptions,
  TeamRoundResult801,
  TeamRoundResult802,
  Version,
} from './types.js';
import type { Game, TournamentData } from '@echecs/tournament';

// Per-player round result reconstructed from CompletedRound[]
interface ReconstructedResult {
  color: 'b' | 'w' | '-';
  opponentId: string | null;
  result: string;
  round: number;
}

function pad(value: string, length: number, align: 'left' | 'right'): string {
  return align === 'right' ? value.padStart(length) : value.padEnd(length);
}

function writeAt(buf: string[], col: number, value: string): void {
  for (const [index, char] of [...value].entries()) {
    buf[col + index] = char;
  }
}

/**
 * Reconstruct per-player round results from completedRounds[].
 * Returns an array of result entries sorted by round number.
 */
function reconstructPlayerResults(
  player: Player,
  data: TournamentData,
): ReconstructedResult[] {
  const results: ReconstructedResult[] = [];

  for (const [roundIndex, round] of data.completedRounds.entries()) {
    const roundNumber = roundIndex + 1;

    // Check for bye first
    const bye = round.byes.find((b) => b.player === player.id);
    if (bye !== undefined) {
      let result: string;
      switch (bye.kind) {
        case 'full': {
          result = 'F';
          break;
        }
        case 'half': {
          result = 'H';
          break;
        }
        case 'pairing': {
          result = 'U';
          break;
        }
        case 'zero': {
          result = 'Z';
          break;
        }
        default: {
          result = 'Z';
        }
      }
      results.push({
        color: '-',
        // eslint-disable-next-line unicorn/no-null
        opponentId: null,
        result,
        round: roundNumber,
      });
      continue;
    }

    // Find the game involving this player
    const game = round.games.find(
      (g) => 'result' in g && (g.white === player.id || g.black === player.id),
    ) as Game | undefined;

    if (game === undefined) {
      continue;
    }

    const isWhite = game.white === player.id;
    const opponentId = isWhite ? game.black : game.white;
    const color: 'w' | 'b' = isWhite ? 'w' : 'b';

    let result: string;

    if ('forfeit' in game && game.forfeit !== undefined) {
      if (game.forfeit === 'both') {
        result = '-';
      } else if (
        (game.forfeit === 'black' && isWhite) ||
        (game.forfeit === 'white' && !isWhite)
      ) {
        // This player wins by forfeit
        result = '+';
      } else {
        // This player forfeits
        result = '-';
      }
    } else {
      // Rated or unrated game
      const rated = 'rated' in game ? (game.rated ?? true) : true;
      if (game.result === 'draw') {
        result = rated ? '=' : 'D';
      } else if (
        (game.result === 'white' && isWhite) ||
        (game.result === 'black' && !isWhite)
      ) {
        // This player wins
        result = rated ? '1' : 'W';
      } else {
        // This player loses
        result = rated ? '0' : 'L';
      }
    }

    results.push({
      color,
      opponentId,
      result,
      round: roundNumber,
    });
  }

  return results;
}

function stringifyPlayerLine(
  player: Player,
  playerIndex: number,
  data: TournamentData,
  version: Version,
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

  // Pairing number — use startingRank if available, otherwise numeric id
  const pairingNumber = player.startingRank ?? Number(player.id);
  writeAt(buf, COL_PAIRING_NUMBER, pad(String(pairingNumber), 4, 'right'));

  // Sex — single char at col 9
  if (player.sex !== undefined) {
    buf[COL_SEX] = player.sex;
  }

  // Title — left-aligned in 4 chars at col 10
  if (player.title !== undefined) {
    writeAt(buf, COL_TITLE, pad(player.title, 4, 'left'));
  }

  // Name — left-aligned in 33 chars at col 14
  const name = player.name ?? '';
  warnIfTruncated(name, 'name', 33, COL_NAME);
  writeAt(buf, COL_NAME, pad(name.slice(0, 33), 33, 'left'));

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

  // Round results — reconstruct from completedRounds
  const results = reconstructPlayerResults(player, data);

  // version param is reserved for future use (e.g. TRF26-specific result codes)
  void version;

  if (results.length > 0) {
    for (const result of results) {
      const slot =
        ROUND_RESULTS_OFFSET + (result.round - 1) * ROUND_ENTRY_LENGTH;
      // Extend buffer if needed
      while (buf.length < slot + ROUND_ENTRY_LENGTH) {
        buf.push(' ');
      }

      const opponentString =
        result.opponentId === null
          ? '0000'
          : String(Number(result.opponentId)).padStart(4, ' ');
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
  data: TournamentData,
  options?: StringifyOptions,
): string {
  const lines: string[] = [];

  const version: Version = options?.version ?? 'TRF16';
  const meta = data.metadata;

  if (version === 'TRF26') {
    for (const comment of meta?.comments ?? []) {
      lines.push(`### ${comment}`);
    }
  }

  if (meta?.name !== undefined) {
    lines.push(`012 ${meta.name}`);
  }
  if (meta?.city !== undefined) {
    lines.push(`022 ${meta.city}`);
  }
  if (meta?.federation !== undefined) {
    lines.push(`032 ${meta.federation}`);
  }
  if (meta?.startDate !== undefined) {
    lines.push(`042 ${meta.startDate}`);
  }
  if (meta?.endDate !== undefined) {
    lines.push(`052 ${meta.endDate}`);
  }

  const numberOfPlayers = options?.numberOfPlayers ?? data.players.length;
  if (numberOfPlayers > 0) {
    lines.push(`062 ${numberOfPlayers}`);
  }

  const numberOfRatedPlayers =
    options?.numberOfRatedPlayers ??
    data.players.filter((p) => p.rating !== undefined).length;
  if (numberOfRatedPlayers > 0) {
    lines.push(`072 ${numberOfRatedPlayers}`);
  }

  const numberOfTeams = options?.numberOfTeams ?? (data.teams ?? []).length;
  if (numberOfTeams > 0) {
    lines.push(`082 ${numberOfTeams}`);
  }

  if (meta?.tournamentType !== undefined) {
    lines.push(`092 ${meta.tournamentType}`);
  }
  if (meta?.chiefArbiter !== undefined) {
    lines.push(`102 ${meta.chiefArbiter}`);
  }
  for (const arbiter of meta?.deputyArbiters ?? []) {
    lines.push(`112 ${arbiter}`);
  }
  if (meta?.timeControl !== undefined) {
    lines.push(`122 ${meta.timeControl}`);
  }
  if (meta?.roundDates !== undefined && meta.roundDates.length > 0) {
    // Round dates occupy 10-char slots starting at col 91 (same as 001 round results).
    const buf: string[] = Array.from(
      { length: ROUND_RESULTS_OFFSET },
      () => ' ',
    );
    buf[0] = '1';
    buf[1] = '3';
    buf[2] = '2';
    for (const [index, date] of meta.roundDates.entries()) {
      const pos = ROUND_RESULTS_OFFSET + index * ROUND_ENTRY_LENGTH;
      while (buf.length < pos + ROUND_ENTRY_LENGTH) {
        buf.push(' ');
      }
      writeAt(buf, pos, date.slice(0, 8));
    }
    lines.push(buf.join('').trimEnd());
  }
  if (data.totalRounds > 0) {
    lines.push(`XXR ${data.totalRounds}`);
  }

  // withdrawnPlayers not yet on TournamentData; XXZ not emitted

  for (const pa of data.playerAccelerations ?? []) {
    const pointsPart = pa.points
      .map((p) => pad(p.toFixed(1), 4, 'right'))
      .join(' ');
    lines.push(`XXA${pad(pa.playerId, 4, 'right')} ${pointsPart}`);
  }

  {
    const xxcParts: string[] = [];
    if (options?.useRankingId === true) {
      xxcParts.push('rank');
    }
    if (version !== 'TRF26' && options?.initialColour !== undefined) {
      xxcParts.push(options.initialColour === 'W' ? 'white1' : 'black1');
    }
    if (xxcParts.length > 0) {
      lines.push(`XXC ${xxcParts.join(' ')}`);
    }
  }

  {
    const s = data.scoringSystem;
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

  if (version === 'TRF26') {
    if (data.totalRounds > 0) {
      lines.push(`142 ${data.totalRounds}`);
    }
    if (options?.initialColour !== undefined) {
      lines.push(`152 ${options.initialColour}`);
    }
    if (data.scoringSystem !== undefined) {
      const s = data.scoringSystem;
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
    // startingRankMethod not yet on TournamentMetadata; 172 not emitted
    if (meta?.pairingController !== undefined) {
      lines.push(`182 ${meta.pairingController}`);
    }
    if (options?.encodedTournamentType !== undefined) {
      lines.push(`192 ${options.encodedTournamentType}`);
    }
    if (data.tiebreaks !== undefined && data.tiebreaks.length > 0) {
      lines.push(`202 ${data.tiebreaks.join(',')}`);
    }
    if (
      options?.standingsTiebreaks !== undefined &&
      options.standingsTiebreaks.length > 0
    ) {
      lines.push(`212 ${options.standingsTiebreaks.join(',')}`);
    }
    if (options?.encodedTimeControl !== undefined) {
      lines.push(`222 ${options.encodedTimeControl}`);
    }
    if (options?.colourSequence !== undefined) {
      lines.push(`352 ${options.colourSequence}`);
    }
    if (options?.teamScoringSystem !== undefined) {
      lines.push(`362 ${options.teamScoringSystem}`);
    }
  }

  for (const [index, player] of data.players.entries()) {
    lines.push(
      stringifyPlayerLine(player, index, data, version, options?.onWarning),
    );
  }

  // NRS records — emitted after all 001 records, TRF26 only
  if (version === 'TRF26') {
    for (const player of data.players) {
      for (const nrs of player.nationalRatings ?? []) {
        const buf: string[] = Array.from({ length: COL_RANK + 5 }, () => ' ');
        // Federation code as record type (3 chars)
        writeAt(buf, 0, nrs.federation.slice(0, 3));
        const nrsPairingNumber = player.startingRank ?? Number(player.id);
        writeAt(
          buf,
          COL_PAIRING_NUMBER,
          pad(String(nrsPairingNumber), 4, 'right'),
        );
        // NationalRating from @echecs/tournament has no sex field; use player's
        // sex for NRS records as per TRF26 spec
        if (player.sex !== undefined) {
          buf[COL_SEX] = player.sex;
        }
        if (nrs.classification !== undefined) {
          writeAt(
            buf,
            COL_TITLE,
            pad(nrs.classification.slice(0, 3), 3, 'left'),
          );
        }
        // Use player's name for the NRS record (TRF26 spec mirrors the player name)
        if (player.name !== undefined) {
          writeAt(buf, COL_NAME, pad(player.name.slice(0, 33), 33, 'left'));
        }
        writeAt(buf, COL_RATING, pad(String(nrs.rating), 4, 'right'));
        if (nrs.nationalId !== undefined) {
          writeAt(
            buf,
            COL_FIDE_ID,
            pad(nrs.nationalId.slice(0, 12), 12, 'left'),
          );
        }
        // Use player's birthDate for NRS records
        if (player.birthDate !== undefined) {
          writeAt(
            buf,
            COL_BIRTH_DATE,
            pad(player.birthDate.slice(0, 10), 10, 'left'),
          );
        }
        lines.push(buf.join('').trimEnd());
      }
    }
  }

  // 240 — Bye records (TRF26 only) — derived from completedRounds byes
  // (tag 240 byes are not on TournamentData; omitted in stringify unless
  //  the caller provides them via options in a future extension)

  // 250 — Accelerated rounds (TRF26 only)
  if (version === 'TRF26') {
    for (const accumulator of data.acceleratedRounds ?? []) {
      lines.push(
        `250 ${accumulator.matchPoints.toFixed(1).padStart(4)} ${accumulator.gamePoints.toFixed(1).padStart(4)} ${String(accumulator.firstRound).padStart(3)} ${String(accumulator.lastRound).padStart(3)} ${String(Number(accumulator.firstPlayerId)).padStart(4)} ${String(Number(accumulator.lastPlayerId)).padStart(4)}`,
      );
    }
  }

  // XXP — Forbidden pairs (all versions; round sentinel 0/0)
  for (const pp of data.prohibitedPairings ?? []) {
    if (pp.firstRound === 0 && pp.lastRound === 0) {
      const idPart = pp.playerIds.join(' ');
      lines.push(`XXP ${idPart}`);
    }
  }

  // 260 — Prohibited pairings (TRF26 only)
  if (version === 'TRF26') {
    for (const pp of data.prohibitedPairings ?? []) {
      if (pp.firstRound !== 0 || pp.lastRound !== 0) {
        const idPart = pp.playerIds
          .map((id) => String(Number(id)).padStart(4))
          .join(' ');
        lines.push(
          `260 ${String(pp.firstRound).padStart(3)} ${String(pp.lastRound).padStart(3)} ${idPart}`,
        );
      }
    }
  }

  // 299 — Abnormal points (TRF26 only) — from options
  if (version === 'TRF26') {
    for (const ab of options?.abnormalPoints ?? []) {
      const roundPart = ab.round === 0 ? '   ' : String(ab.round).padStart(3);
      const idPart =
        ab.playerIds.length === 0
          ? ''
          : ' ' +
            ab.playerIds.map((id) => String(Number(id)).padStart(4)).join(' ');
      lines.push(
        `299 ${ab.type}  ${ab.matchPoints.toFixed(1).padStart(4)}  ${ab.gamePoints.toFixed(1).padStart(4)}  ${roundPart}${idPart}`,
      );
    }
  }

  // 300 — Out-of-order lineups (TRF26 only) — from options
  if (version === 'TRF26') {
    for (const ool of options?.outOfOrderLineups ?? []) {
      const idPart = ool.playerIds
        .map((id) => (id === null ? '0000' : String(Number(id)).padStart(4)))
        .join(' ');
      lines.push(
        `300 ${String(Number(ool.round)).padStart(3)} ${String(Number(ool.teamId)).padStart(3)} ${String(Number(ool.opponentTeamId)).padStart(3)} ${idPart}`,
      );
    }
  }

  // 320 — Team PAB (TRF26 only) — from options
  if (version === 'TRF26' && options?.teamPairingAllocatedByes !== undefined) {
    const pab = options.teamPairingAllocatedByes;
    const roundParts = pab.teamIdPerRound
      .map((id) => (id === null ? '000' : String(Number(id)).padStart(3)))
      .join(' ');
    lines.push(
      `320 ${pab.matchPoints.toFixed(1).padStart(4)} ${pab.gamePoints.toFixed(1).padStart(4)} ${roundParts}`,
    );
  }

  // 330 — Forfeited matches (TRF26 only) — from options
  if (version === 'TRF26') {
    for (const fm of options?.forfeitedMatches ?? []) {
      lines.push(
        `330 ${fm.type} ${String(Number(fm.round)).padStart(3)} ${String(Number(fm.whiteTeamId)).padStart(3)} ${String(Number(fm.blackTeamId)).padStart(3)}`,
      );
    }
  }

  // Team records (310) — TRF26 only
  if (version === 'TRF26') {
    for (const team of data.teams ?? []) {
      const buf: string[] = Array.from({ length: 72 }, () => ' ');
      buf[0] = '3';
      buf[1] = '1';
      buf[2] = '0';
      writeAt(buf, 4, pad(String(Number(team.id)), 3, 'right'));
      writeAt(buf, 8, pad(team.name.slice(0, 32), 32, 'left'));
      if (team.nickname !== undefined) {
        writeAt(buf, 41, pad(team.nickname.slice(0, 5), 5, 'left'));
      }
      writeAt(buf, 54, pad(team.matchPoints.toFixed(1), 6, 'right'));
      writeAt(buf, 61, pad(team.gamePoints.toFixed(1), 6, 'right'));
      writeAt(buf, 68, pad(String(team.rank), 3, 'right'));
      for (const [index, id] of team.playerIds.entries()) {
        const pos = 73 + index * 5;
        while (buf.length < pos + 4) {
          buf.push(' ');
        }
        writeAt(buf, pos, pad(String(Number(id)), 4, 'right'));
      }
      lines.push(buf.join('').trimEnd());
    }
  }

  // 801/802 — Team round-by-round results (TRF26 only) — from options
  if (version === 'TRF26') {
    for (const record of options?.teamRoundResults ?? []) {
      if (record.tag === '801') {
        const buf801: string[] = Array.from({ length: 22 }, () => ' ');
        writeAt(buf801, 0, '801');
        writeAt(buf801, 3, pad(String(Number(record.teamId)), 4, 'right'));
        if (record.nickname !== undefined) {
          writeAt(buf801, 7, pad(record.nickname.slice(0, 5), 5, 'left'));
        }
        writeAt(buf801, 12, pad(String(record.matchPoints), 4, 'right'));
        writeAt(buf801, 16, pad(record.gamePoints.toFixed(1), 6, 'right'));
        for (const r of record.results as TeamRoundResult801[]) {
          const pos = 22 + (r.round - 1) * 16;
          while (buf801.length < pos + 16) {
            buf801.push(' ');
          }
          if (r.type === undefined) {
            const oppString =
              r.opponentId === null ? '' : String(Number(r.opponentId));
            writeAt(buf801, pos, `  ${pad(oppString, 3, 'right')} ${r.raw}`);
          } else {
            // Bye: write marker centered in block
            const BYE_MARKER_801: Record<string, string> = {
              FPB: 'FFFF',
              HPB: 'HHHH',
              PAB: 'PPPP',
              ZPB: 'ZZZZ',
            };
            const marker = BYE_MARKER_801[r.type] ?? 'ZZZZ';
            writeAt(buf801, pos + 5, `  ${marker}       `);
          }
        }
        lines.push(buf801.join('').trimEnd());
      } else {
        // 802
        const buf802: string[] = Array.from({ length: 28 }, () => ' ');
        writeAt(buf802, 0, '802');
        writeAt(buf802, 4, pad(String(Number(record.teamId)), 3, 'right'));
        if (record.nickname !== undefined) {
          writeAt(buf802, 8, pad(record.nickname.slice(0, 5), 5, 'left'));
        }
        writeAt(buf802, 14, pad(record.matchPoints.toFixed(1), 6, 'right'));
        writeAt(buf802, 21, pad(record.gamePoints.toFixed(1), 6, 'right'));
        for (const r of record.results as TeamRoundResult802[]) {
          const pos = 28 + (r.round - 1) * 13;
          while (buf802.length < pos + 13) {
            buf802.push(' ');
          }
          if (r.type === undefined) {
            const oppString =
              r.opponentId === null ? '' : String(Number(r.opponentId));
            writeAt(buf802, pos, pad(oppString, 3, 'right'));
            if (r.color !== undefined) {
              buf802[pos + 4] = r.color;
            }
            writeAt(buf802, pos + 6, pad(r.gamePoints.toFixed(1), 4, 'right'));
            if (r.forfeit === true) {
              buf802[pos + 10] = 'f';
            }
          } else {
            // Bye type
            writeAt(buf802, pos, r.type);
            writeAt(buf802, pos + 6, pad(r.gamePoints.toFixed(1), 4, 'right'));
          }
        }
        lines.push(buf802.join('').trimEnd());
      }
    }
  }

  return lines.join('\n');
}
