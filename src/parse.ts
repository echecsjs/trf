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
  AbnormalPoints,
  NationalRating,
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  PlayerAcceleration,
  ResultCode,
  ScoringSystem,
  Team,
  TeamRoundResult801,
  TeamRoundResult802,
  Tournament,
  TrfBye,
  Version,
} from './types.js';
import type { Bye, CompletedRound, Game } from '@echecs/tournament';

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

const TRF26_ONLY_TAGS = new Set([
  '###',
  '142',
  '152',
  '162',
  '172',
  '182',
  '192',
  '202',
  '212',
  '222',
  '240',
  '250',
  '260',
  '299',
  '300',
  '310',
  '320',
  '330',
  '352',
  '362',
  '801',
  '802',
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
    const opponentRaw = parts[0];
    const colorRaw = parts[1];
    const resultRaw = parts[2];

    if (
      opponentRaw === undefined ||
      colorRaw === undefined ||
      resultRaw === undefined
    ) {
      continue;
    }

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

function detectVersion(lines: string[]): Version {
  for (const line of lines) {
    const tag = line.slice(0, 3);
    if (TRF26_ONLY_TAGS.has(tag)) {
      return 'TRF26';
    }
    // NRS record: exactly 3 uppercase letters not already known
    if (/^[A-Z]{3}$/.test(tag) && !KNOWN_HEADER_TAGS.has(tag)) {
      return 'TRF26';
    }
  }
  return 'TRF16';
}

// ---------------------------------------------------------------------------
// Build CompletedRound[] from per-player raw round data
// ---------------------------------------------------------------------------

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
      const entry = player._rawRounds.find((r) => r.round === roundNumber);
      if (entry === undefined) continue;

      // Byes: opponentId is null
      if (entry.opponentId === null) {
        const byeResult = entry.result;
        let byeKind: Bye['kind'];
        switch (byeResult) {
          case 'F': {
            byeKind = 'full';
            break;
          }
          case 'H': {
            byeKind = 'half';
            break;
          }
          case 'Z': {
            byeKind = 'zero';
            break;
          }
          case 'U': {
            byeKind = 'pairing';
            break;
          }
          default: {
            // Other result codes with no opponent (e.g., '+', '-' with 0000)
            byeKind = 'zero';
          }
        }
        byes.push({ kind: byeKind, player: player.id });
        continue;
      }

      // Only process games from the white player's perspective to avoid duplicates
      if (entry.color !== 'w') {
        continue;
      }

      const pairKey = [player.id, entry.opponentId].toSorted().join(':');
      if (processedPairs.has(pairKey)) {
        continue;
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
        const game: Game = {
          black: blackId,
          forfeit: 'both',
          result: 'none',
          white: whiteId,
        };
        games.push(game);
        continue;
      }

      // Determine the game from white's result code
      let game: Game | undefined;

      switch (whiteResult) {
        case '1': {
          game = {
            black: blackId,
            rated: true,
            result: 'white',
            white: whiteId,
          };
          break;
        }
        case '0': {
          game = {
            black: blackId,
            rated: true,
            result: 'black',
            white: whiteId,
          };
          break;
        }
        case '=': {
          game = {
            black: blackId,
            rated: true,
            result: 'draw',
            white: whiteId,
          };
          break;
        }
        case 'W': {
          game = {
            black: blackId,
            rated: false,
            result: 'white',
            white: whiteId,
          };
          break;
        }
        case 'L': {
          game = {
            black: blackId,
            rated: false,
            result: 'black',
            white: whiteId,
          };
          break;
        }
        case 'D': {
          game = {
            black: blackId,
            rated: false,
            result: 'draw',
            white: whiteId,
          };
          break;
        }
        case '+': {
          // White wins by forfeit (black forfeits)
          game = {
            black: blackId,
            forfeit: 'black',
            result: 'white',
            white: whiteId,
          };
          break;
        }
        case '-': {
          // White forfeits (black wins by forfeit)
          game = {
            black: blackId,
            forfeit: 'white',
            result: 'black',
            white: whiteId,
          };
          break;
        }
        default: {
          // Unknown result — try to use black's result if available
          if (blackResult !== undefined) {
            switch (blackResult) {
              case '1': {
                game = {
                  black: blackId,
                  rated: true,
                  result: 'black',
                  white: whiteId,
                };
                break;
              }
              case '0': {
                game = {
                  black: blackId,
                  rated: true,
                  result: 'white',
                  white: whiteId,
                };
                break;
              }
              case '=': {
                game = {
                  black: blackId,
                  rated: true,
                  result: 'draw',
                  white: whiteId,
                };
                break;
              }
              case 'W': {
                game = {
                  black: blackId,
                  rated: false,
                  result: 'black',
                  white: whiteId,
                };
                break;
              }
              case 'L': {
                game = {
                  black: blackId,
                  rated: false,
                  result: 'white',
                  white: whiteId,
                };
                break;
              }
              case 'D': {
                game = {
                  black: blackId,
                  rated: false,
                  result: 'draw',
                  white: whiteId,
                };
                break;
              }
              case '+': {
                game = {
                  black: blackId,
                  forfeit: 'white',
                  result: 'black',
                  white: whiteId,
                };
                break;
              }
              case '-': {
                game = {
                  black: blackId,
                  forfeit: 'black',
                  result: 'white',
                  white: whiteId,
                };
                break;
              }
              default:
              // Can't determine result
            }
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
        }
      }

      games.push(game);
    }

    // Also check for players who played black but their white opponent isn't in the list
    // (handles missing white player entries)
    for (const player of players) {
      const entry = player._rawRounds.find((r) => r.round === roundNumber);
      if (
        entry === undefined ||
        entry.opponentId === null ||
        entry.color !== 'b'
      ) {
        continue;
      }

      const pairKey = [player.id, entry.opponentId].toSorted().join(':');
      if (processedPairs.has(pairKey)) {
        continue;
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

      let game: Game;
      switch (blackResult) {
        case '1': {
          game = {
            black: blackId,
            rated: true,
            result: 'black',
            white: whiteId,
          };
          break;
        }
        case '0': {
          game = {
            black: blackId,
            rated: true,
            result: 'white',
            white: whiteId,
          };
          break;
        }
        case '=': {
          game = {
            black: blackId,
            rated: true,
            result: 'draw',
            white: whiteId,
          };
          break;
        }
        case 'W': {
          game = {
            black: blackId,
            rated: false,
            result: 'black',
            white: whiteId,
          };
          break;
        }
        case 'L': {
          game = {
            black: blackId,
            rated: false,
            result: 'white',
            white: whiteId,
          };
          break;
        }
        case 'D': {
          game = {
            black: blackId,
            rated: false,
            result: 'draw',
            white: whiteId,
          };
          break;
        }
        case '+': {
          game = {
            black: blackId,
            forfeit: 'white',
            result: 'black',
            white: whiteId,
          };
          break;
        }
        case '-': {
          game = {
            black: blackId,
            forfeit: 'black',
            result: 'white',
            white: whiteId,
          };
          break;
        }
        default: {
          game = {
            black: blackId,
            rated: false,
            result: 'draw',
            white: whiteId,
          };
        }
      }

      games.push(game);
    }

    completedRounds.push({ byes, games });
  }

  return completedRounds;
}

// ---------------------------------------------------------------------------
// parse()
// ---------------------------------------------------------------------------

export default function parse(
  input: string,
  options?: ParseOptions,
): Tournament | null {
  const content = input.replace(/^\uFEFF/, '').trim();

  if (content.length === 0) {
    options?.onError?.(makeError('Input is empty'));
    // eslint-disable-next-line unicorn/no-null
    return null;
  }

  const lines = content.split('\n');
  const version = detectVersion(lines);

  const tournament: Tournament = {
    completedRounds: [],
    players: [],
    totalRounds: 0,
    version,
  };

  // Track the byte offset of the start of each line within `content`.
  // Used to report accurate `offset` values in ParseWarning/ParseError.
  let lineOffset = 0;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
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
        const n062 = Number(line.slice(4).trim());
        if (n062 > 0) {
          tournament.numberOfPlayers = n062;
        }
        break;
      }
      case '072': {
        const n072 = Number(line.slice(4).trim());
        if (n072 > 0) {
          tournament.numberOfRatedPlayers = n072;
        }
        break;
      }
      case '082': {
        const n082 = Number(line.slice(4).trim());
        if (n082 > 0) {
          tournament.numberOfTeams = n082;
        }
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
        const c = line.slice(4).trim();
        if (c === 'W' || c === 'B') {
          tournament.initialColour = c;
        }
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
        if (Object.keys(scoring).length > 0) {
          tournament.scoringSystem = scoring;
        }
        break;
      }
      case '172': {
        const srm = line.slice(4).trim();
        if (srm.length > 0) {
          tournament.startingRankMethod = srm;
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
        const ett = line.slice(4).trim();
        if (ett.length > 0) {
          tournament.encodedTournamentType = ett;
        }
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
        const value212 = line.slice(4).trim();
        if (value212.length > 0) {
          tournament.standingsTiebreaks = value212
            .split(',')
            .map((s) => s.trim());
        }
        break;
      }
      case '222': {
        const etc = line.slice(4).trim();
        if (etc.length > 0) {
          tournament.encodedTimeControl = etc;
        }
        break;
      }
      case '352': {
        const cs = line.slice(4).trim();
        if (cs.length > 0) {
          tournament.colourSequence = cs;
        }
        break;
      }
      case '362': {
        const tss = line.slice(4).trim();
        if (tss.length > 0) {
          tournament.teamScoringSystem = tss;
        }
        break;
      }
      case 'XXC': {
        for (const token of line.slice(4).trim().split(/\s+/)) {
          switch (token) {
            case 'rank': {
              tournament.useRankingId = true;

              break;
            }
            case 'white1': {
              tournament.initialColour = 'W';

              break;
            }
            case 'black1': {
              tournament.initialColour = 'B';

              break;
            }
            // No default
          }
        }
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
          tournament.absentPlayers ??= [];
          tournament.absentPlayers.push(...ids);
        }
        break;
      }
      case '013': {
        // Legacy team record — recognised for backward compatibility, values not stored
        break;
      }
      case '240': {
        const typeRaw = line.slice(4, 5).trim();
        if (typeRaw === 'F' || typeRaw === 'H' || typeRaw === 'Z') {
          const round = Number(line.slice(6, 9).trim()) || 0;
          const playerIds: string[] = [];
          for (let pos = 10; pos < line.length; pos += 5) {
            const id = Number(line.slice(pos, pos + 4).trim());
            if (id > 0) {
              playerIds.push(String(id));
            }
          }
          const trfBye: TrfBye = { playerIds, round, type: typeRaw };
          tournament.byes ??= [];
          tournament.byes.push(trfBye);
        }
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
        const type299 = validTypes299.has(typeRaw299)
          ? (typeRaw299 as AbnormalPoints['type'])
          : ' ';
        const matchPoints299 = Number(line.slice(7, 11).trim()) || 0;
        const gamePoints299 = Number(line.slice(13, 17).trim()) || 0;
        const round299 = Number(line.slice(19, 22).trim()) || 0;
        const playerIds299: string[] = [];
        for (let pos = 23; pos < line.length; pos += 5) {
          const id = Number(line.slice(pos, pos + 4).trim());
          if (id > 0) {
            playerIds299.push(String(id));
          }
        }
        tournament.abnormalPoints ??= [];
        tournament.abnormalPoints.push({
          gamePoints: gamePoints299,
          matchPoints: matchPoints299,
          playerIds: playerIds299,
          round: round299,
          type: type299,
        });
        break;
      }
      case '300': {
        const round300 = Number(line.slice(4, 7).trim()) || 0;
        const teamId300 = Number(line.slice(8, 11).trim()) || 0;
        const opponentTeamId300 = Number(line.slice(12, 15).trim()) || 0;
        const playerIds300: (string | null)[] = [];
        for (let pos = 16; pos < line.length; pos += 5) {
          const raw300 = line.slice(pos, pos + 4).trim();
          const id300 = Number(raw300);
          playerIds300.push(
            raw300 === '' || id300 === 0 ? null : String(id300), // eslint-disable-line unicorn/no-null
          );
        }
        tournament.outOfOrderLineups ??= [];
        tournament.outOfOrderLineups.push({
          opponentTeamId: String(opponentTeamId300),
          playerIds: playerIds300,
          round: round300,
          teamId: String(teamId300),
        });
        break;
      }
      case '320': {
        const matchPoints320 = Number(line.slice(4, 8).trim()) || 0;
        const gamePoints320 = Number(line.slice(9, 13).trim()) || 0;
        const teamIdPerRound320: (string | null)[] = [];
        for (let pos = 14; pos < line.length; pos += 4) {
          const raw320 = line.slice(pos, pos + 3).trim();
          if (raw320 === '') {
            break;
          }
          const id320 = Number(raw320);
          teamIdPerRound320.push(id320 === 0 ? null : String(id320)); // eslint-disable-line unicorn/no-null
        }
        tournament.teamPairingAllocatedByes = {
          gamePoints: gamePoints320,
          matchPoints: matchPoints320,
          teamIdPerRound: teamIdPerRound320,
        };
        break;
      }
      case '330': {
        const typeRaw330 = line.slice(4, 6);
        if (typeRaw330 === '+-' || typeRaw330 === '-+' || typeRaw330 === '--') {
          const round330 = Number(line.slice(7, 10).trim()) || 0;
          const whiteTeamId330 = Number(line.slice(11, 14).trim()) || 0;
          const blackTeamId330 = Number(line.slice(15, 18).trim()) || 0;
          tournament.forfeitedMatches ??= [];
          tournament.forfeitedMatches.push({
            blackTeamId: String(blackTeamId330),
            round: round330,
            type: typeRaw330,
            whiteTeamId: String(whiteTeamId330),
          });
        }
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
        const BYE_MAP_801: Record<string, 'FPB' | 'HPB' | 'PAB' | 'ZPB'> = {
          FFFF: 'FPB',
          HHHH: 'HPB',
          PPPP: 'PAB',
          ZZZZ: 'ZPB',
        };

        const teamId801 = Number(line.slice(3, 7).trim()) || 0;
        if (teamId801 === 0) break;

        const nickname801 = line.slice(7, 12).trim() || undefined;
        const matchPoints801 = Number(line.slice(12, 16).trim()) || 0;
        const gamePoints801 = Number(line.slice(16, 22).trim()) || 0;

        const results801: TeamRoundResult801[] = [];
        let round801 = 1;
        for (let pos = 22; pos < line.length; pos += 16) {
          const block = line.slice(pos, pos + 16);
          if (block.trim().length === 0) break;

          // Check for bye marker (FFFF, HHHH, ZZZZ anywhere in block)
          const blockTrimmed = block.trim();
          const byeType = BYE_MAP_801[blockTrimmed];
          if (byeType === undefined) {
            // Normal round: opponent in first ~4 chars, rest is raw
            const oppRaw = block.slice(0, 5).trim();
            const opponentId =
              oppRaw === '' || Number(oppRaw) === 0
                ? null // eslint-disable-line unicorn/no-null
                : String(Number(oppRaw));
            const raw = block.slice(5).trimEnd();

            results801.push({
              opponentId,
              raw,
              round: round801,
            });
          } else {
            results801.push({
              opponentId: null, // eslint-disable-line unicorn/no-null
              raw: blockTrimmed,
              round: round801,
              type: byeType,
            });
          }

          round801 += 1;
        }

        tournament.teamRoundResults ??= [];
        tournament.teamRoundResults.push({
          gamePoints: gamePoints801,
          matchPoints: matchPoints801,
          nickname: nickname801,
          results: results801,
          tag: '801',
          teamId: String(teamId801),
        });

        break;
      }
      case '802': {
        const BYE_TYPES_802 = new Set(['FPB', 'HPB', 'PAB', 'ZPB']);
        const teamId802 = Number(line.slice(4, 7).trim()) || 0;
        if (teamId802 === 0) break;

        const nickname802 = line.slice(8, 13).trim() || undefined;
        const matchPoints802 = Number(line.slice(14, 20).trim()) || 0;
        const gamePoints802 = Number(line.slice(21, 27).trim()) || 0;

        const results802: TeamRoundResult802[] = [];
        let round802 = 1;
        for (let pos = 28; pos < line.length; pos += 13) {
          const block = line.slice(pos, pos + 13);
          if (block.trim().length === 0) break;

          const oppRaw = block.slice(0, 3).trim();
          const isBye = BYE_TYPES_802.has(oppRaw);

          const colorRaw = block[4]?.trim() ?? '';
          const gpRaw = block.slice(6, 10).trim();
          const forfeitRaw = block[10]?.trim() ?? '';

          const entry: TeamRoundResult802 = {
            gamePoints: Number(gpRaw) || 0,

            opponentId: isBye
              ? null // eslint-disable-line unicorn/no-null
              : oppRaw === '' || Number(oppRaw) === 0
                ? null // eslint-disable-line unicorn/no-null
                : String(Number(oppRaw)),
            round: round802,
          };

          if (isBye) {
            entry.type = oppRaw as 'FPB' | 'HPB' | 'PAB' | 'ZPB';
          }
          if (colorRaw === 'w' || colorRaw === 'b') {
            entry.color = colorRaw;
          }
          if (forfeitRaw === 'f' || forfeitRaw === 'F') {
            entry.forfeit = true;
          }

          results802.push(entry);
          round802 += 1;
        }

        tournament.teamRoundResults ??= [];
        tournament.teamRoundResults.push({
          gamePoints: gamePoints802,
          matchPoints: matchPoints802,
          nickname: nickname802,
          results: results802,
          tag: '802',
          teamId: String(teamId802),
        });

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
                const classificationRaw = line
                  .slice(COL_TITLE, COL_NAME)
                  .trim();
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
