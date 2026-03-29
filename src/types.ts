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

interface AcceleratedRound {
  firstPlayerId: number;
  firstRound: number;
  gamePoints: number;
  lastPlayerId: number;
  lastRound: number;
  matchPoints: number;
}

interface AbnormalPoints {
  gamePoints: number;
  matchPoints: number;
  playerIds: number[];
  round: number;
  type: ' ' | '+' | '-' | 'D' | 'F' | 'H' | 'L' | 'W' | 'Z';
}

interface Bye {
  playerIds: number[];
  round: number;
  type: 'F' | 'H' | 'Z';
}

interface ForfeitedMatch {
  blackTeamId: number;
  round: number;
  type: '--' | '-+' | '+-';
  whiteTeamId: number;
}

interface OutOfOrderLineup {
  opponentTeamId: number;
  playerIds: (number | null)[];
  round: number;
  teamId: number;
}

interface ProhibitedPairing {
  firstRound: number;
  lastRound: number;
  playerIds: number[];
}

interface TeamPairingAllocatedBye {
  gamePoints: number;
  matchPoints: number;
  teamIdPerRound: (number | null)[];
}

interface Tournament {
  abnormalPoints?: AbnormalPoints[];
  acceleratedRounds?: AcceleratedRound[];
  byes?: Bye[];
  chiefArbiter?: string;
  city?: string;
  comments?: string[];
  deputyArbiters?: string[];
  endDate?: string;
  federation?: string;
  forfeitedMatches?: ForfeitedMatch[];
  initialColour?: 'B' | 'W';
  name?: string;
  numberOfPlayers?: number;
  numberOfRatedPlayers?: number;
  numberOfTeams?: number;
  outOfOrderLineups?: OutOfOrderLineup[];
  pairingController?: string;
  players: Player[];
  prohibitedPairings?: ProhibitedPairing[];
  roundDates?: string[];
  rounds: number;
  standingsTiebreaks?: string[];
  startDate?: string;
  teamPairingAllocatedByes?: TeamPairingAllocatedBye;
  teams?: Team[];
  tiebreaks?: string[];
  timeControl?: string;
  tournamentType?: string;
  version: Version;
}

export type {
  AcceleratedRound,
  AbnormalPoints,
  Bye,
  ForfeitedMatch,
  NationalRating,
  OutOfOrderLineup,
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  ProhibitedPairing,
  ResultCode,
  RoundResult,
  Sex,
  StringifyOptions,
  Team,
  TeamPairingAllocatedBye,
  Title,
  Tournament,
  Version,
};
