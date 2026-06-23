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
  NationalRating,
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  PlayerAcceleration,
  ResultCode,
  ScoringSystem,
  Team,
} from './types.js';
import type {
  Bye,
  CompletedRound,
  Game,
  TournamentData,
} from '@echecs/tournament';

const KNOWN_HEADER_TAGS = new Set([
  '###',
  '001',
  '012',
  '022',
  '032',
  '042',
  '052',
  '062',
  '072',
  '082',
  '092',
  '102',
  '112',
  '122',
  '162',
  '172',
  '192',
  '202',
  '212',
  '222',
  '240',
  '250',
  '260',
  '299',
  '300',
  '320',
  '330',
  '352',
  '362',
  '801',
  '802',
  'XXA',
  'XXC',
  'XXP',
  'XXR',
  'XXS',
  'XXZ',
]);

const VALID_RESULT_CODES = new Set<ResultCode>([
  '+',
  '-',
  '0',
  '1',
  '=',
  'D',
  'F',
  'H',
  'L',
  'U',
  'W',
  'Z',
]);

type Sex = 'm' | 'w';
const VALID_SEXES = new Set<Sex>(['m', 'w']);

type Title = 'CM' | 'FM' | 'GM' | 'IM' | 'WCM' | 'WFM' | 'WGM' | 'WIM';
const VALID_TITLES = new Set<Title>([
  'CM',
  'FM',
  'GM',
  'IM',
  'WCM',
  'WFM',
  'WGM',
  'WIM',
]);

// JaVaFo (pre-TRF16) used single-letter lowercase title codes.
// Map them to standard TRF16 Title values for backward compatibility.
const JAVAFO_TITLE_MAP = new Map<string, Title>([
  ['f', 'FM'],
  ['g', 'GM'],
  ['m', 'IM'],
  ['w', 'WIM'],
]);

// Internal per-player round entry used during parsing before building CompletedRound[].
interface RawRoundEntry {
  color: 'b' | 'w' | '-';
  opponentId: string | null;
  result: ResultCode;
  round: number;
}

// Internal player representation with raw round entries (before CompletedRound assembly).
interface PlayerWithRaw extends Player {
  _rawRounds: RawRoundEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resultToByeKind(result: ResultCode): Bye['kind'] {
  switch (result) {
    case 'F': {
      return 'full';
    }
    case 'H': {
      return 'half';
    }
    case 'Z': {
      return 'zero';
    }
    case 'U': {
      return 'pairing';
    }
    default: {
      // Other result codes with no opponent (e.g., '+', '-' with 0000)
      return 'zero';
    }
  }
}

function resultToGame(
  resultCode: ResultCode,
  whiteId: string,
  blackId: string,
  perspective: 'black' | 'white',
): Game | undefined {
  // When perspective is 'black', win/loss are inverted (black's '1' means black won)
  const isBlack = perspective === 'black';
  switch (resultCode) {
    case '1': {
      return {
        black: blackId,
        rated: true,
        result: isBlack ? 'black' : 'white',
        white: whiteId,
      };
    }
    case '0': {
      return {
        black: blackId,
        rated: true,
        result: isBlack ? 'white' : 'black',
        white: whiteId,
      };
    }
    case '=': {
      return {
        black: blackId,
        rated: true,
        result: 'draw',
        white: whiteId,
      };
    }
    case 'W': {
      return {
        black: blackId,
        rated: false,
        result: isBlack ? 'black' : 'white',
        white: whiteId,
      };
    }
    case 'L': {
      return {
        black: blackId,
        rated: false,
        result: isBlack ? 'white' : 'black',
        white: whiteId,
      };
    }
    case 'D': {
      return {
        black: blackId,
        rated: false,
        result: 'draw',
        white: whiteId,
      };
    }
    case '+': {
      // The player with this code wins by forfeit (opponent forfeits)
      return isBlack
        ? {
            black: blackId,
            forfeit: 'white' as const,
            result: 'black' as const,
            white: whiteId,
          }
        : {
            black: blackId,
            forfeit: 'black' as const,
            result: 'white' as const,
            white: whiteId,
          };
    }
    case '-': {
      // The player with this code forfeits (opponent wins)
      return isBlack
        ? {
            black: blackId,
            forfeit: 'black' as const,
            result: 'white' as const,
            white: whiteId,
          }
        : {
            black: blackId,
            forfeit: 'white' as const,
            result: 'black' as const,
            white: whiteId,
          };
    }
    default: {
      return undefined;
    }
  }
}

function applyScoringCode(
  scoring: ScoringSystem,
  code: string,
  pts: number,
): void {
  switch (code) {
    case 'W': {
      scoring.win = pts;
      break;
    }
    case 'D': {
      scoring.draw = pts;
      break;
    }
    case 'L': {
      scoring.loss = pts;
      break;
    }
    case 'A': {
      scoring.absence = pts;
      break;
    }
    case 'P': {
      scoring.pairingAllocatedBye = pts;
      break;
    }
    case 'X': {
      scoring.unknown = pts;
      break;
    }
    default: {
      break;
    }
  }
}

function applyXxsScoringCode(
  s: ScoringSystem,
  code: string,
  value: number,
): void {
  switch (code) {
    case 'WW': {
      s.whiteWin = value;
      break;
    }
    case 'BW': {
      s.blackWin = value;
      break;
    }
    case 'WD': {
      s.whiteDraw = value;
      break;
    }
    case 'BD': {
      s.blackDraw = value;
      break;
    }
    case 'WL': {
      s.whiteLoss = value;
      break;
    }
    case 'BL': {
      s.blackLoss = value;
      break;
    }
    case 'ZPB': {
      s.zeroPointBye = value;
      break;
    }
    case 'HPB': {
      s.halfPointBye = value;
      break;
    }
    case 'FPB': {
      s.fullPointBye = value;
      break;
    }
    case 'PAB': {
      s.pairingAllocatedBye = value;
      break;
    }
    case 'FW': {
      s.forfeitWin = value;
      break;
    }
    case 'FL': {
      s.forfeitLoss = value;
      break;
    }
    case 'W': {
      s.whiteWin = value;
      s.blackWin = value;
      s.forfeitWin = value;
      s.fullPointBye = value;
      break;
    }
    case 'D': {
      s.whiteDraw = value;
      s.blackDraw = value;
      s.halfPointBye = value;
      break;
    }
    default: {
      break;
    }
  }
}

function makeError(message: string): ParseError {
  return { column: 0, line: 0, message, offset: 0 };
}

function makeWarning(
  message: string,
  line: number,
  column: number,
  offset: number,
): ParseWarning {
  return { column, line, message, offset };
}

function parseRating(
  raw: string,
  lineNumber: number,
  lineOffset: number,
  onWarning?: (w: ParseWarning) => void,
): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const n = Number(trimmed);
  // 0 is the conventional sentinel for "unrated" in JaVaFo and some tools.
  if (n === 0) {
    return undefined;
  }
  if (!Number.isFinite(n) || n < 0) {
    onWarning?.(
      makeWarning(
        `Malformed rating: "${trimmed}"`,
        lineNumber,
        COL_RATING + 1,
        lineOffset + COL_RATING,
      ),
    );
    return undefined;
  }

  return n;
}

function parsePlayerLine(
  line: string,
  lineNumber: number,
  lineOffset: number,
  onWarning?: (w: ParseWarning) => void,
): PlayerWithRaw {
  const pairingNumber =
    Number(line.slice(COL_PAIRING_NUMBER, COL_SEX).trim()) || 0;

  const sexRaw = line.slice(COL_SEX, COL_SEX + 1).trim();
  const sex = VALID_SEXES.has(sexRaw as Sex) ? (sexRaw as Sex) : undefined;

  const titleRaw = line.slice(COL_TITLE, COL_NAME).trim();
  const title = VALID_TITLES.has(titleRaw as Title)
    ? (titleRaw as Title)
    : JAVAFO_TITLE_MAP.get(titleRaw);

  const name = line.slice(COL_NAME, COL_RATING - 1).trim();
  const rating = parseRating(
    line.slice(COL_RATING, COL_RATING + 4),
    lineNumber,
    lineOffset,
    onWarning,
  );

  const federationRaw = line.slice(COL_FEDERATION, COL_FEDERATION + 3).trim();
  const federation = federationRaw.length > 0 ? federationRaw : undefined;

  const fideIdRaw = line.slice(COL_FIDE_ID, COL_BIRTH_DATE - 1).trim();
  const fideId = fideIdRaw.length > 0 ? fideIdRaw : undefined;

  const birthDateRaw = line.slice(COL_BIRTH_DATE, COL_POINTS).trim();
  const birthDate = birthDateRaw.length > 0 ? birthDateRaw : undefined;

  const points = Number(line.slice(COL_POINTS, COL_POINTS + 4).trim()) || 0;
  // rank defaults to 0 when blank (required field with no optional counterpart)
  const rank = Number(line.slice(COL_RANK, COL_RANK + 5).trim()) || 0;

  const rawRounds: RawRoundEntry[] = [];
  const resultsSection = line.slice(ROUND_RESULTS_OFFSET);

  for (
    let index = 0;
    index < resultsSection.length;
    index += ROUND_ENTRY_LENGTH
  ) {
    const entry = resultsSection
      .slice(index, index + ROUND_ENTRY_LENGTH)
      .trim();
    if (entry.length === 0) {
      continue;
    }

    const parts = entry.split(/\s+/);
    if (parts.length < 3) {
      continue;
    }
    const opponentRaw = parts[0] as string;
    const colorRaw = parts[1] as string;
    const resultRaw = parts[2] as string;

    const entryOffset = lineOffset + ROUND_RESULTS_OFFSET + index;
    const entryColumn = ROUND_RESULTS_OFFSET + index + 1;

    if (!VALID_RESULT_CODES.has(resultRaw as ResultCode)) {
      onWarning?.(
        makeWarning(
          `Unknown result code "${resultRaw}" in round ${Math.floor(index / ROUND_ENTRY_LENGTH) + 1}`,
          lineNumber,
          entryColumn,
          entryOffset,
        ),
      );
      continue;
    }

    if (colorRaw !== 'w' && colorRaw !== 'b' && colorRaw !== '-') {
      onWarning?.(
        makeWarning(
          `Invalid color code "${colorRaw}" in round ${Math.floor(index / ROUND_ENTRY_LENGTH) + 1}`,
          lineNumber,
          entryColumn,
          entryOffset,
        ),
      );
      continue;
    }
    // '-' is the TRF marker for byes (no color assigned); preserve as-is
    const colorMap: Record<string, 'b' | 'w' | '-'> = { b: 'b', w: 'w' };
    const color: 'b' | 'w' | '-' = colorMap[colorRaw] ?? '-';
    const round = Math.floor(index / ROUND_ENTRY_LENGTH) + 1;

    rawRounds.push({
      color,
      opponentId: opponentRaw === '0000' ? null : String(Number(opponentRaw)), // eslint-disable-line unicorn/no-null
      result: resultRaw as ResultCode,
      round,
    });
  }

  const player: PlayerWithRaw = {
    _rawRounds: rawRounds,
    id: String(pairingNumber),
    points,
    rank,
    startingRank: pairingNumber,
  };

  if (birthDate !== undefined) player.birthDate = birthDate;
  if (federation !== undefined) player.federation = federation;
  if (fideId !== undefined) player.fideId = fideId;
  if (name.length > 0) player.name = name;
  if (rating !== undefined) player.rating = rating;
  if (sex !== undefined) player.sex = sex;
  if (title !== undefined) player.title = title;

  return player;
}

// ---------------------------------------------------------------------------
// Build CompletedRound[] from per-player raw round data
// ---------------------------------------------------------------------------

function processWhitePlayerRound(
  player: PlayerWithRaw,
  roundNumber: number,
  playerMap: Map<string, PlayerWithRaw>,
  processedPairs: Set<string>,
  games: Game[],
  byes: Bye[],
  onWarning?: (w: ParseWarning) => void,
): void {
  const entry = player._rawRounds.find((r) => r.round === roundNumber);
  if (entry === undefined) {
    return;
  }

  // Byes: opponentId is null
  if (entry.opponentId === null) {
    byes.push({ kind: resultToByeKind(entry.result), player: player.id });
    return;
  }

  // Only process games from the white player's perspective to avoid duplicates
  if (entry.color !== 'w') {
    return;
  }

  const pairKey = [player.id, entry.opponentId]
    .toSorted((a, b) => a.localeCompare(b))
    .join(':');
  if (processedPairs.has(pairKey)) {
    return;
  }
  processedPairs.add(pairKey);

  const opponentEntry = playerMap
    .get(entry.opponentId)
    ?._rawRounds.find((r) => r.round === roundNumber);

  // Build the Game from white's perspective
  const whiteId = player.id;
  const blackId = entry.opponentId;
  const whiteResult = entry.result;
  const blackResult = opponentEntry?.result;

  // Handle double forfeit
  if (whiteResult === '-' && blackResult === '-') {
    games.push({
      black: blackId,
      forfeit: 'both',
      result: 'none',
      white: whiteId,
    });
    return;
  }

  // Determine the game from white's result code
  let game: Game | undefined = resultToGame(
    whiteResult,
    whiteId,
    blackId,
    'white',
  );

  // Unknown result — try to use black's result if available
  if (game === undefined && blackResult !== undefined) {
    game = resultToGame(blackResult, whiteId, blackId, 'black');
  }

  if (game === undefined) {
    onWarning?.(
      makeWarning(
        `Cannot determine game result for players ${whiteId} vs ${blackId} in round ${roundNumber}`,
        0,
        0,
        0,
      ),
    );
    // Fallback: create a draw
    game = {
      black: blackId,
      rated: false,
      result: 'draw',
      white: whiteId,
    };
  }

  games.push(game);
}

function processBlackPlayerRound(
  player: PlayerWithRaw,
  roundNumber: number,
  processedPairs: Set<string>,
  games: Game[],
  onWarning?: (w: ParseWarning) => void,
): void {
  const entry = player._rawRounds.find((r) => r.round === roundNumber);
  if (entry === undefined || entry.opponentId === null || entry.color !== 'b') {
    return;
  }

  const pairKey = [player.id, entry.opponentId]
    .toSorted((a, b) => a.localeCompare(b))
    .join(':');
  if (processedPairs.has(pairKey)) {
    return;
  }
  processedPairs.add(pairKey);

  // White player is the opponent (who has no 001 line or had no entry for this round)
  const whiteId = entry.opponentId;
  const blackId = player.id;
  const blackResult = entry.result;

  onWarning?.(
    makeWarning(
      `White player ${whiteId} has no entry for round ${roundNumber}; game derived from black player ${blackId}`,
      0,
      0,
      0,
    ),
  );

  const game: Game = resultToGame(blackResult, whiteId, blackId, 'black') ?? {
    black: blackId,
    rated: false,
    result: 'draw',
    white: whiteId,
  };

  games.push(game);
}

function buildCompletedRounds(
  players: PlayerWithRaw[],
  totalRounds: number,
  onWarning?: (w: ParseWarning) => void,
): CompletedRound[] {
  const completedRounds: CompletedRound[] = [];

  // Build a map from player id → player for quick lookup
  const playerMap = new Map<string, PlayerWithRaw>();
  for (const player of players) {
    playerMap.set(player.id, player);
  }

  // Determine the actual number of rounds if totalRounds is 0
  let maxRound = totalRounds;
  if (maxRound === 0) {
    for (const player of players) {
      for (const entry of player._rawRounds) {
        if (entry.round > maxRound) {
          maxRound = entry.round;
        }
      }
    }
  }

  for (let roundNumber = 1; roundNumber <= maxRound; roundNumber++) {
    const games: Game[] = [];
    const byes: Bye[] = [];
    const processedPairs = new Set<string>();

    for (const player of players) {
      processWhitePlayerRound(
        player,
        roundNumber,
        playerMap,
        processedPairs,
        games,
        byes,
        onWarning,
      );
    }

    // Also check for players who played black but their white opponent isn't in the list
    // (handles missing white player entries)
    for (const player of players) {
      processBlackPlayerRound(
        player,
        roundNumber,
        processedPairs,
        games,
        onWarning,
      );
    }

    completedRounds.push({ byes, games });
  }

  return completedRounds;
}

// ---------------------------------------------------------------------------
// processTag() — dispatch a single TRF line by its 3-char tag
// ---------------------------------------------------------------------------

function processTag(
  tournament: TournamentData,
  line: string,
  lineNumber: number,
  lineOffset: number,
  options?: ParseOptions,
): void {
  const tag = line.slice(0, 3);

  switch (tag) {
    case '###': {
      tournament.metadata ??= {};
      tournament.metadata.comments ??= [];
      tournament.metadata.comments.push(line.slice(4));
      break;
    }
    case '001': {
      tournament.players.push(
        parsePlayerLine(line, lineNumber, lineOffset, options?.onWarning),
      );
      break;
    }
    case '012': {
      tournament.metadata ??= {};
      tournament.metadata.name = line.slice(4).trim();
      break;
    }
    case '022': {
      tournament.metadata ??= {};
      tournament.metadata.city = line.slice(4).trim();
      break;
    }
    case '032': {
      tournament.metadata ??= {};
      tournament.metadata.federation = line.slice(4).trim();
      break;
    }
    case '042': {
      tournament.metadata ??= {};
      tournament.metadata.startDate = line.slice(4).trim();
      break;
    }
    case '052': {
      tournament.metadata ??= {};
      tournament.metadata.endDate = line.slice(4).trim();
      break;
    }
    case '062': {
      // numberOfPlayers is TRF-specific; not stored on TournamentData
      break;
    }
    case '072': {
      // numberOfRatedPlayers is TRF-specific; not stored on TournamentData
      break;
    }
    case '082': {
      // numberOfTeams is TRF-specific; not stored on TournamentData
      break;
    }
    case '092': {
      tournament.metadata ??= {};
      tournament.metadata.tournamentType = line.slice(4).trim();
      break;
    }
    case '102': {
      tournament.metadata ??= {};
      tournament.metadata.chiefArbiter = line.slice(4).trim();
      break;
    }
    case '112': {
      tournament.metadata ??= {};
      tournament.metadata.deputyArbiters ??= [];
      tournament.metadata.deputyArbiters.push(line.slice(4).trim());
      break;
    }
    case '122': {
      tournament.metadata ??= {};
      tournament.metadata.timeControl = line.slice(4).trim();
      break;
    }
    case '132': {
      // Round dates: one date per round in 10-char slots starting at col 91
      // (same offset as round results in 001 lines). Format: YY/MM/DD (8 chars).
      const dates: string[] = [];
      for (
        let pos = ROUND_RESULTS_OFFSET;
        pos < line.length;
        pos += ROUND_ENTRY_LENGTH
      ) {
        const date = line.slice(pos, pos + 8).trim();
        if (date.length > 0) {
          dates.push(date);
        }
      }
      if (dates.length > 0) {
        tournament.metadata ??= {};
        tournament.metadata.roundDates = dates;
      }
      break;
    }
    // 142 is the TRF26 equivalent of XXR; if both are present, last occurrence wins.
    case '142': {
      const r = Number(line.slice(4).trim());
      if (r > 0) {
        tournament.totalRounds = r;
      }
      break;
    }
    case '152': {
      // initialColour is TRF-specific; not stored on TournamentData
      break;
    }
    case '162': {
      const scoring: ScoringSystem = {};
      // Position-based: code at col 5 (0-indexed), points at cols 6–9,
      // repeating every 9 chars (cols 14, 23, 32…).
      for (let pos = 5; pos < line.length; pos += 9) {
        const code = line[pos]?.trim();
        if (!code) continue;
        const raw = line.slice(pos + 1, pos + 5).trim();
        const pts = Number(raw);
        if (raw.length === 0 || Number.isNaN(pts)) continue;
        applyScoringCode(scoring, code, pts);
      }
      if (Object.keys(scoring).length > 0) {
        tournament.scoringSystem = scoring;
      }
      break;
    }
    case '172': {
      const srm = line.slice(4).trim();
      if (srm.length > 0) {
        tournament.metadata ??= {};
        tournament.metadata.startingRankMethod = srm;
      }
      break;
    }
    case '182': {
      const pc = line.slice(4).trim();
      if (pc.length > 0) {
        tournament.metadata ??= {};
        tournament.metadata.pairingController = pc;
      }
      break;
    }
    case '192': {
      // encodedTournamentType is TRF-specific; not stored on TournamentData
      break;
    }
    case '202': {
      const value202 = line.slice(4).trim();
      if (value202.length > 0) {
        tournament.tiebreaks = value202.split(',').map((s) => s.trim());
      }
      break;
    }
    case '212': {
      // standingsTiebreaks is TRF-specific; not stored on TournamentData
      break;
    }
    case '222': {
      // encodedTimeControl is TRF-specific; not stored on TournamentData
      break;
    }
    case '352': {
      // colourSequence is TRF-specific; not stored on TournamentData
      break;
    }
    case '362': {
      // teamScoringSystem is TRF-specific; not stored on TournamentData
      break;
    }
    case 'XXC': {
      // useRankingId and initialColour are TRF-specific; not stored on TournamentData
      break;
    }
    case 'XXA': {
      const xxaPairingNumber = Number(line.slice(4, 8).trim());
      if (xxaPairingNumber > 0) {
        const xxaPoints: number[] = [];
        for (let pos = 9; pos < line.length; pos += 5) {
          const raw = line.slice(pos, pos + 4).trim();
          if (raw.length === 0) continue;
          const n = Number(raw);
          if (!Number.isNaN(n)) {
            xxaPoints.push(n);
          }
        }
        const xxaEntry: PlayerAcceleration = {
          playerId: String(xxaPairingNumber),
          points: xxaPoints,
        };
        tournament.playerAccelerations ??= [];
        tournament.playerAccelerations.push(xxaEntry);
      }
      break;
    }
    case 'XXR': {
      tournament.totalRounds = Number(line.slice(4).trim()) || 0;
      break;
    }
    case 'XXP': {
      const xxpIds = line
        .slice(4)
        .trim()
        .split(/\s+/)
        .map(Number)
        .filter((n) => n > 0)
        .map(String);
      if (xxpIds.length > 0) {
        tournament.prohibitedPairings ??= [];
        tournament.prohibitedPairings.push({
          firstRound: 0,
          lastRound: 0,
          playerIds: xxpIds,
        });
      }
      break;
    }
    case 'XXS': {
      tournament.scoringSystem ??= {};
      const s = tournament.scoringSystem;
      for (const token of line.slice(4).trim().split(/\s+/)) {
        const eqIndex = token.indexOf('=');
        if (eqIndex === -1) continue;
        const code = token.slice(0, eqIndex);
        const value = Number(token.slice(eqIndex + 1));
        if (Number.isNaN(value)) continue;
        applyXxsScoringCode(s, code, value);
      }
      break;
    }
    case 'XXZ': {
      const ids = line
        .slice(4)
        .trim()
        .split(/\s+/)
        .map(Number)
        .filter((n) => n > 0)
        .map(String);
      if (ids.length > 0) {
        tournament.withdrawnPlayers ??= [];
        tournament.withdrawnPlayers.push(...ids);
      }
      break;
    }
    case '013': {
      // Legacy team record — recognised for backward compatibility, values not stored
      break;
    }
    case '240': {
      // byes (tag 240) are TRF-specific; not stored on TournamentData
      break;
    }
    case '250': {
      const matchPoints250 = Number(line.slice(4, 8).trim()) || 0;
      const gamePoints250 = Number(line.slice(9, 13).trim()) || 0;
      const firstRound250 = Number(line.slice(14, 17).trim()) || 0;
      const lastRound250 = Number(line.slice(18, 21).trim()) || 0;
      const firstPlayerId250 = Number(line.slice(22, 26).trim()) || 0;
      const lastPlayerId250 = Number(line.slice(27, 31).trim()) || 0;
      tournament.acceleratedRounds ??= [];
      tournament.acceleratedRounds.push({
        firstPlayerId: String(firstPlayerId250),
        firstRound: firstRound250,
        gamePoints: gamePoints250,
        lastPlayerId: String(lastPlayerId250),
        lastRound: lastRound250,
        matchPoints: matchPoints250,
      });
      break;
    }
    case '260': {
      const firstRound260 = Number(line.slice(4, 7).trim()) || 0;
      const lastRound260 = Number(line.slice(8, 11).trim()) || 0;
      const playerIds260: string[] = [];
      for (let pos = 12; pos < line.length; pos += 5) {
        const id = Number(line.slice(pos, pos + 4).trim());
        if (id > 0) {
          playerIds260.push(String(id));
        }
      }
      tournament.prohibitedPairings ??= [];
      tournament.prohibitedPairings.push({
        firstRound: firstRound260,
        lastRound: lastRound260,
        playerIds: playerIds260,
      });
      break;
    }
    case '299': {
      const typeRaw299 = line.slice(4, 5);
      const validTypes299 = new Set([
        ' ',
        '+',
        '-',
        'D',
        'F',
        'H',
        'L',
        'W',
        'Z',
      ]);
      const type299 = validTypes299.has(typeRaw299) ? typeRaw299 : ' ';
      const gamePoints299 = Number(line.slice(13, 17).trim()) || 0;
      const round299 = Number(line.slice(19, 22).trim()) || 0;
      const playerIds299: string[] = [];
      for (let pos = 23; pos < line.length; pos += 5) {
        const id = Number(line.slice(pos, pos + 4).trim());
        if (id > 0) {
          playerIds299.push(String(id));
        }
      }
      tournament.adjustments ??= [];
      for (const playerId of playerIds299) {
        tournament.adjustments.push({
          playerId,
          points: gamePoints299,
          reason: `abnormal points (type: ${type299})`,
          round: round299,
        });
      }
      break;
    }
    case '300': {
      // outOfOrderLineups is TRF-specific; not stored on TournamentData
      break;
    }
    case '320': {
      // teamPairingAllocatedByes is TRF-specific; not stored on TournamentData
      break;
    }
    case '330': {
      // forfeitedMatches is TRF-specific; not stored on TournamentData
      break;
    }
    case '310': {
      const pairingNumber = Number(line.slice(4, 7).trim()) || 0;
      const name = line.slice(8, 40).trim();
      const nickname = line.slice(41, 46).trim() || undefined;
      const matchPoints = Number(line.slice(54, 60).trim()) || 0;
      const gamePoints = Number(line.slice(61, 67).trim()) || 0;
      const rank = Number(line.slice(68, 71).trim()) || 0;
      const playerIds: string[] = [];
      for (let pos = 73; pos < line.length; pos += 5) {
        const id = Number(line.slice(pos, pos + 4).trim());
        if (id > 0) {
          playerIds.push(String(id));
        }
      }
      if (pairingNumber > 0) {
        const team: Team = {
          gamePoints,
          id: String(pairingNumber),
          matchPoints,
          name,
          playerIds,
          rank,
        };
        if (nickname !== undefined) {
          team.nickname = nickname;
        }
        tournament.teams ??= [];
        tournament.teams.push(team);
      }
      break;
    }
    case '801': {
      // teamRoundResults (801) is TRF-specific; not stored on TournamentData
      break;
    }
    case '802': {
      // teamRoundResults (802) is TRF-specific; not stored on TournamentData
      break;
    }
    default: {
      // NRS record: exactly 3 uppercase letters not in KNOWN_HEADER_TAGS,
      // with a positive national rating. Silently ignored if the matching
      // player is not found.
      if (/^[A-Z]{3}$/.test(tag) && !KNOWN_HEADER_TAGS.has(tag)) {
        const pairingNumber =
          Number(line.slice(COL_PAIRING_NUMBER, COL_SEX).trim()) || 0;
        const ratingRaw = line.slice(COL_RATING, COL_RATING + 4).trim();
        const rating = Number(ratingRaw);
        if (pairingNumber > 0) {
          if (rating > 0) {
            const player = tournament.players.find(
              (p) => p.id === String(pairingNumber),
            );
            if (player !== undefined) {
              player.nationalRatings ??= [];
              const classificationRaw = line.slice(COL_TITLE, COL_NAME).trim();
              const nationalIdRaw = line
                .slice(COL_FIDE_ID, COL_BIRTH_DATE - 1)
                .trim();
              const nrs: NationalRating = {
                federation: tag,
                rating,
              };
              if (classificationRaw.length > 0) {
                nrs.classification = classificationRaw;
              }
              if (nationalIdRaw.length > 0) {
                nrs.nationalId = nationalIdRaw;
              }
              player.nationalRatings.push(nrs);
            }
          }
          // Break for any NRS-formatted line (pairingNumber > 0), regardless
          // of whether a matching player was found or the rating was valid.
          break;
        }
      }

      if (!KNOWN_HEADER_TAGS.has(tag) && tag.trim().length > 0) {
        options?.onWarning?.(
          makeWarning(`Unknown tag "${tag}"`, lineNumber, 1, lineOffset),
        );
      }

      break;
    }
  }
}

// ---------------------------------------------------------------------------
// parse()
// ---------------------------------------------------------------------------

export default function parse(
  input: string,
  options?: ParseOptions,
): TournamentData | null {
  const content = input.replace(/^\u{FEFF}/u, '').trim();

  if (content.length === 0) {
    options?.onError?.(makeError('Input is empty'));
    // eslint-disable-next-line unicorn/no-null
    return null;
  }

  const lines = content.split('\n');

  const tournament: TournamentData = {
    completedRounds: [],
    players: [],
    totalRounds: 0,
  };

  // Track the byte offset of the start of each line within `content`.
  // Used to report accurate `offset` values in ParseWarning/ParseError.
  let lineOffset = 0;

  for (const [index, line] of lines.entries()) {
    processTag(tournament, line, index + 1, lineOffset, options);

    // +1 for the '\n' character that was stripped by split()
    lineOffset += line.length + 1;
  }

  // Build completedRounds from per-player raw round data
  const playersWithRaw = tournament.players as PlayerWithRaw[];
  tournament.completedRounds = buildCompletedRounds(
    playersWithRaw,
    tournament.totalRounds,
    options?.onWarning,
  );

  // Strip internal _rawRounds from players before returning
  for (const player of tournament.players as PlayerWithRaw[]) {
    delete (player as { _rawRounds?: unknown })._rawRounds;
  }

  return tournament;
}
