interface ScoringSystem {
  absence?: number;
  blackDraw?: number;
  blackLoss?: number;
  blackWin?: number;
  draw?: number;
  forfeitLoss?: number;
  forfeitWin?: number;
  fullPointBye?: number;
  halfPointBye?: number;
  loss?: number;
  pairingAllocatedBye?: number;
  unknown?: number;
  whiteDraw?: number;
  whiteLoss?: number;
  whiteWin?: number;
  win?: number;
  zeroPointBye?: number;
}

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

interface PlayerAcceleration {
  pairingNumber: number;
  points: number[];
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

interface TeamRoundResult {
  gamePoints: number;
  matchPoints: number;
  nickname?: string;
  results: TeamRoundResult801[] | TeamRoundResult802[];
  tag: '801' | '802';
  teamId: number;
}

interface TeamRoundResult801 {
  opponentId: number | null;
  raw: string;
  round: number;
  type?: 'FPB' | 'HPB' | 'PAB' | 'ZPB';
}

interface TeamRoundResult802 {
  color?: 'b' | 'w';
  forfeit?: boolean;
  gamePoints: number;
  opponentId: number | null;
  round: number;
  type?: 'FPB' | 'HPB' | 'PAB' | 'ZPB';
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
  absentPlayers?: number[];
  acceleratedRounds?: AcceleratedRound[];
  byes?: Bye[];
  chiefArbiter?: string;
  city?: string;
  colourSequence?: string;
  comments?: string[];
  deputyArbiters?: string[];
  encodedTimeControl?: string;
  encodedTournamentType?: string;
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
  playerAccelerations?: PlayerAcceleration[];
  players: Player[];
  prohibitedPairings?: ProhibitedPairing[];
  roundDates?: string[];
  rounds: number;
  scoringSystem?: ScoringSystem;
  standingsTiebreaks?: string[];
  startDate?: string;
  startingRankMethod?: string;
  teamPairingAllocatedByes?: TeamPairingAllocatedBye;
  teamRoundResults?: TeamRoundResult[];
  teamScoringSystem?: string;
  teams?: Team[];
  tiebreaks?: string[];
  timeControl?: string;
  tournamentType?: string;
  useRankingId?: boolean;
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
  PlayerAcceleration,
  ProhibitedPairing,
  ResultCode,
  RoundResult,
  ScoringSystem,
  Sex,
  StringifyOptions,
  Team,
  TeamPairingAllocatedBye,
  TeamRoundResult,
  TeamRoundResult801,
  TeamRoundResult802,
  Title,
  Tournament,
  Version,
};
