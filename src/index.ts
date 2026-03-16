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



// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROUND_RESULTS_OFFSET = 91;
const ROUND_ENTRY_LENGTH = 10;

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

const VALID_SEXES = new Set<Sex>(['f', 'm']);

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(message: string): ParseError {
  return { column: 1, line: 1, message, offset: 0 };
}

function makeWarning(message: string, line: number): ParseWarning {
  return { column: 1, line, message, offset: 0 };
}

function parseRating(
  raw: string,
  lineNumber: number,
  onWarning?: (w: ParseWarning) => void,
): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    onWarning?.(makeWarning(`Malformed rating: "${trimmed}"`, lineNumber));
    return undefined;
  }

  return n;
}

function parsePlayerLine(
  line: string,
  lineNumber: number,
  onWarning?: (w: ParseWarning) => void,
): Player {
  const pairingNumber = Number(line.slice(4, 8).trim()) || 0;

  const sexRaw = line.slice(9, 10).trim();
  const sex = VALID_SEXES.has(sexRaw as Sex) ? (sexRaw as Sex) : undefined;

  const titleRaw = line.slice(10, 14).trim();
  const title = VALID_TITLES.has(titleRaw as Title)
    ? (titleRaw as Title)
    : undefined;

  const name = line.slice(14, 47).trim();
  const rating = parseRating(line.slice(48, 52), lineNumber, onWarning);

  const federationRaw = line.slice(53, 56).trim();
  const federation = federationRaw.length > 0 ? federationRaw : undefined;

  const fideIdRaw = line.slice(57, 69).trim();
  const fideId = fideIdRaw.length > 0 ? fideIdRaw : undefined;

  const birthDateRaw = line.slice(70, 80).trim();
  const birthDate = birthDateRaw.length > 0 ? birthDateRaw : undefined;

  const points = Number(line.slice(80, 84).trim()) || 0;
  const rank = Number(line.slice(84, 89).trim()) || 0;

  const results: RoundResult[] = [];
  const resultsSection = line.slice(ROUND_RESULTS_OFFSET);

  for (
    let index = 0;
    index < resultsSection.length;
    index += ROUND_ENTRY_LENGTH
  ) {
    const entry = resultsSection.slice(index, index + ROUND_ENTRY_LENGTH).trim();
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

    if (!VALID_RESULT_CODES.has(resultRaw as ResultCode)) {
      onWarning?.(
        makeWarning(
          `Unknown result code "${resultRaw}" in round ${Math.floor(index / ROUND_ENTRY_LENGTH) + 1}`,
          lineNumber,
        ),
      );
      continue;
    }

    const color = colorRaw === 'w' ? ('w' as const) : ('b' as const);
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

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    const tag = line.slice(0, 3);

    switch (tag) {
      case '001': {
        tournament.players.push(
          parsePlayerLine(line, lineNumber, options?.onWarning),
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
          options?.onWarning?.(makeWarning(`Unknown tag "${tag}"`, lineNumber));
        }

        break;
      }
    }
  }

  return tournament;
}

export {type ParseError, type ParseOptions, type ParseWarning, type Player, type ResultCode, type RoundResult, type Sex, type Title, type Tournament, type Version} from './types.js';