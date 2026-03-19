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
  ResultCode,
  RoundResult,
  Sex,
  Team,
  Title,
  Tournament,
  Version,
} from './types.js';

// XXC is recognised (no unknown-tag warning) but its value is not currently
// used — it is silenced intentionally.
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
  'XXC',
  'XXR',
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

const VALID_SEXES = new Set<Sex>(['m', 'w']);

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
): Player {
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

  const results: RoundResult[] = [];
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
    const color: 'b' | 'w' | '-' =
      colorRaw === 'w' ? 'w' : colorRaw === 'b' ? 'b' : '-';
    // eslint-disable-next-line unicorn/no-null
    const opponentId = opponentRaw === '0000' ? null : Number(opponentRaw);
    const round = Math.floor(index / ROUND_ENTRY_LENGTH) + 1;

    results.push({
      color,
      opponentId,
      result: resultRaw as ResultCode,
      round,
    });
  }

  return {
    birthDate,
    federation,
    fideId,
    name,
    pairingNumber,
    points,
    rank,
    rating,
    results,
    sex,
    title,
  };
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
    players: [],
    rounds: 0,
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
        tournament.comments ??= [];
        tournament.comments.push(line.slice(4));
        break;
      }
      case '001': {
        tournament.players.push(
          parsePlayerLine(line, lineNumber, lineOffset, options?.onWarning),
        );
        break;
      }
      case '012': {
        tournament.name = line.slice(4).trim();
        break;
      }
      case '022': {
        tournament.city = line.slice(4).trim();
        break;
      }
      case '032': {
        tournament.federation = line.slice(4).trim();
        break;
      }
      case '042': {
        tournament.startDate = line.slice(4).trim();
        break;
      }
      case '052': {
        tournament.endDate = line.slice(4).trim();
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
        tournament.tournamentType = line.slice(4).trim();
        break;
      }
      case '102': {
        tournament.chiefArbiter = line.slice(4).trim();
        break;
      }
      case '112': {
        tournament.deputyArbiters ??= [];
        tournament.deputyArbiters.push(line.slice(4).trim());
        break;
      }
      case '122': {
        tournament.timeControl = line.slice(4).trim();
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
          tournament.roundDates = dates;
        }
        break;
      }
      // 142 is the TRF26 equivalent of XXR; if both are present, last occurrence wins.
      case '142': {
        const r = Number(line.slice(4).trim());
        if (r > 0) {
          tournament.rounds = r;
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
      case '182': {
        const pc = line.slice(4).trim();
        if (pc.length > 0) {
          tournament.pairingController = pc;
        }
        break;
      }
      case 'XXR': {
        tournament.rounds = Number(line.slice(4).trim()) || 0;
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
          const playerIds: number[] = [];
          for (let pos = 10; pos < line.length; pos += 5) {
            const id = Number(line.slice(pos, pos + 4).trim());
            if (id > 0) {
              playerIds.push(id);
            }
          }
          tournament.byes ??= [];
          tournament.byes.push({ playerIds, round, type: typeRaw });
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
          firstPlayerId: firstPlayerId250,
          firstRound: firstRound250,
          gamePoints: gamePoints250,
          lastPlayerId: lastPlayerId250,
          lastRound: lastRound250,
          matchPoints: matchPoints250,
        });
        break;
      }
      case '260': {
        const firstRound260 = Number(line.slice(4, 7).trim()) || 0;
        const lastRound260 = Number(line.slice(8, 11).trim()) || 0;
        const playerIds260: number[] = [];
        for (let pos = 12; pos < line.length; pos += 5) {
          const id = Number(line.slice(pos, pos + 4).trim());
          if (id > 0) {
            playerIds260.push(id);
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
        const playerIds299: number[] = [];
        for (let pos = 23; pos < line.length; pos += 5) {
          const id = Number(line.slice(pos, pos + 4).trim());
          if (id > 0) {
            playerIds299.push(id);
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
        const playerIds300: (number | null)[] = [];
        for (let pos = 16; pos < line.length; pos += 5) {
          const raw300 = line.slice(pos, pos + 4).trim();
          const id300 = Number(raw300);
          // eslint-disable-next-line unicorn/no-null
          playerIds300.push(raw300 === '' || id300 === 0 ? null : id300);
        }
        tournament.outOfOrderLineups ??= [];
        tournament.outOfOrderLineups.push({
          opponentTeamId: opponentTeamId300,
          playerIds: playerIds300,
          round: round300,
          teamId: teamId300,
        });
        break;
      }
      case '320': {
        const matchPoints320 = Number(line.slice(4, 8).trim()) || 0;
        const gamePoints320 = Number(line.slice(9, 13).trim()) || 0;
        const teamIdPerRound320: (number | null)[] = [];
        for (let pos = 14; pos < line.length; pos += 4) {
          const raw320 = line.slice(pos, pos + 3).trim();
          if (raw320 === '') {
            break;
          }
          const id320 = Number(raw320);
          // eslint-disable-next-line unicorn/no-null
          teamIdPerRound320.push(id320 === 0 ? null : id320);
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
            blackTeamId: blackTeamId330,
            round: round330,
            type: typeRaw330,
            whiteTeamId: whiteTeamId330,
          });
        }
        break;
      }
      case '310': {
        const pairingNumber = Number(line.slice(4, 7).trim()) || 0;
        const name = line.slice(8, 40).trim();
        const nickname = line.slice(41, 46).trim() || undefined;
        const strengthFactorRaw = line.slice(47, 53).trim();
        const strengthFactor =
          strengthFactorRaw.length > 0
            ? Number(strengthFactorRaw) || undefined
            : undefined;
        const matchPoints = Number(line.slice(54, 60).trim()) || 0;
        const gamePoints = Number(line.slice(61, 67).trim()) || 0;
        const rank = Number(line.slice(68, 71).trim()) || 0;
        const playerIds: number[] = [];
        for (let pos = 73; pos < line.length; pos += 5) {
          const id = Number(line.slice(pos, pos + 4).trim());
          if (id > 0) {
            playerIds.push(id);
          }
        }
        if (pairingNumber > 0) {
          const team: Team = {
            gamePoints,
            matchPoints,
            name,
            pairingNumber,
            playerIds,
            rank,
          };
          if (nickname !== undefined) {
            team.nickname = nickname;
          }
          if (strengthFactor !== undefined) {
            team.strengthFactor = strengthFactor;
          }
          tournament.teams ??= [];
          tournament.teams.push(team);
        }
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
                (p) => p.pairingNumber === pairingNumber,
              );
              if (player !== undefined) {
                player.nationalRatings ??= [];
                const sexRaw = line.slice(COL_SEX, COL_SEX + 1).trim();
                const classificationRaw = line
                  .slice(COL_TITLE, COL_NAME)
                  .trim();
                const nameRaw = line.slice(COL_NAME, COL_RATING - 1).trim();
                const originRaw = line
                  .slice(COL_FEDERATION, COL_FEDERATION + 3)
                  .trim();
                const nationalIdRaw = line
                  .slice(COL_FIDE_ID, COL_BIRTH_DATE - 1)
                  .trim();
                const birthDateRaw = line
                  .slice(COL_BIRTH_DATE, COL_POINTS)
                  .trim();
                const nrs: NationalRating = {
                  federation: tag,
                  pairingNumber,
                  rating,
                };
                if (classificationRaw.length > 0) {
                  nrs.classification = classificationRaw;
                }
                if (nameRaw.length > 0) {
                  nrs.name = nameRaw;
                }
                if (originRaw.length > 0) {
                  nrs.origin = originRaw;
                }
                if (nationalIdRaw.length > 0) {
                  nrs.nationalId = nationalIdRaw;
                }
                if (birthDateRaw.length > 0) {
                  nrs.birthDate = birthDateRaw;
                }
                if (VALID_SEXES.has(sexRaw as Sex)) {
                  nrs.sex = sexRaw as Sex;
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

  return tournament;
}
