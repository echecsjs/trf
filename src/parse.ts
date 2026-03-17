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
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  ResultCode,
  RoundResult,
  Sex,
  Title,
  Tournament,
  Version,
} from './types.js';

// Tags 062–122 and XXC are recognised (no unknown-tag warning) but their
// values are not currently used — they are silenced intentionally.
const KNOWN_HEADER_TAGS = new Set([
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
  'XXC',
  'XXR',
]);

const VALID_RESULT_CODES = new Set<ResultCode>([
  '+',
  '-',
  '0',
  '1',
  '=',
  'F',
  'H',
  'U',
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
    // '-' is the TRF marker for byes (no color assigned); treat as 'b' for storage
    const color: 'b' | 'w' = colorRaw === 'w' ? 'w' : 'b';
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

function detectVersion(): Version {
  // TRF26 heuristics deferred — all content treated as TRF16 for now
  // TODO: detect TRF26 from content once the spec stabilises
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

  const version = detectVersion();

  const tournament: Tournament = {
    players: [],
    rounds: 0,
    version,
  };

  const lines = content.split('\n');

  // Track the byte offset of the start of each line within `content`.
  // Used to report accurate `offset` values in ParseWarning/ParseError.
  let lineOffset = 0;

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const tag = line.slice(0, 3);

    switch (tag) {
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
      case '092': {
        tournament.chiefArbiter = line.slice(4).trim();
        break;
      }
      case '112': {
        tournament.timeControl = line.slice(4).trim();
        break;
      }
      case 'XXR': {
        tournament.rounds = Number(line.slice(4).trim()) || 0;
        break;
      }
      default: {
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
