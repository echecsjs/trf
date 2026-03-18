type ResultCode =
  | '+'
  | '-'
  | '0'
  | '1'
  | '='
  | 'D'
  | 'F'
  | 'H'
  | 'L'
  | 'U'
  | 'W'
  | 'Z';

type Sex = 'm' | 'w';

type Title = 'CM' | 'FM' | 'GM' | 'IM' | 'WCM' | 'WFM' | 'WGM' | 'WIM';

type Version = 'TRF16' | 'TRF26';

interface ParseError {
  column: number;
  line: number;
  message: string;
  offset: number;
}

interface ParseOptions {
  onError?: (error: ParseError) => void;
  onWarning?: (warning: ParseWarning) => void;
}

interface ParseWarning {
  column: number;
  line: number;
  message: string;
  offset: number;
}

interface StringifyOptions {
  onWarning?: (warning: ParseWarning) => void;
}

interface NationalRating {
  birthDate?: string;
  classification?: string;
  federation: string;
  name?: string;
  nationalId?: string;
  origin?: string;
  pairingNumber: number;
  rating: number;
  sex?: Sex;
}

interface Player {
  birthDate?: string;
  federation?: string;
  fideId?: string;
  name: string;
  nationalRatings?: NationalRating[];
  pairingNumber: number;
  points: number;
  rank: number;
  rating?: number;
  results: RoundResult[];
  sex?: Sex;
  title?: Title;
}

interface RoundResult {
  color: 'b' | 'w' | '-';
  opponentId: number | null;
  result: ResultCode;
  round: number;
}

interface Team {
  gamePoints: number;
  matchPoints: number;
  name: string;
  nickname?: string;
  pairingNumber: number;
  playerIds: number[];
  rank: number;
  strengthFactor?: number;
}

interface Tournament {
  chiefArbiter?: string;
  city?: string;
  comments?: string[];
  deputyArbiters?: string[];
  endDate?: string;
  federation?: string;
  initialColour?: 'B' | 'W';
  name?: string;
  numberOfPlayers?: number;
  numberOfRatedPlayers?: number;
  numberOfTeams?: number;
  pairingController?: string;
  players: Player[];
  rounds: number;
  startDate?: string;
  teams?: Team[];
  timeControl?: string;
  tournamentType?: string;
  version: Version;
}

export type {
  NationalRating,
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  ResultCode,
  RoundResult,
  Sex,
  StringifyOptions,
  Team,
  Title,
  Tournament,
  Version,
};
