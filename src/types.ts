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

interface AbnormalPoints {
  gamePoints: number;
  matchPoints: number;
  playerIds: string[];
  round: number;
  type: ' ' | '+' | '-' | 'D' | 'F' | 'H' | 'L' | 'W' | 'Z';
}

interface ForfeitedMatch {
  blackTeamId: string;
  round: number;
  type: '--' | '-+' | '+-';
  whiteTeamId: string;
}

interface OutOfOrderLineup {
  opponentTeamId: string;
  playerIds: (string | null)[];
  round: number;
  teamId: string;
}

interface TeamPairingAllocatedBye {
  gamePoints: number;
  matchPoints: number;
  teamIdPerRound: (string | null)[];
}

interface TeamRoundResult {
  gamePoints: number;
  matchPoints: number;
  nickname?: string;
  results: TeamRoundResult801[] | TeamRoundResult802[];
  tag: '801' | '802';
  teamId: string;
}

interface TeamRoundResult801 {
  opponentId: string | null;
  raw: string;
  round: number;
  type?: 'FPB' | 'HPB' | 'PAB' | 'ZPB';
}

interface TeamRoundResult802 {
  color?: 'b' | 'w';
  forfeit?: boolean;
  gamePoints: number;
  opponentId: string | null;
  round: number;
  type?: 'FPB' | 'HPB' | 'PAB' | 'ZPB';
}

/** TRF-specific bye record (tag 240) — distinct from tournament's per-round Bye. */
interface TrfBye {
  playerIds: string[];
  round: number;
  type: 'F' | 'H' | 'Z';
}

interface StringifyOptions {
  abnormalPoints?: AbnormalPoints[];
  colourSequence?: string;
  encodedTimeControl?: string;
  encodedTournamentType?: string;
  forfeitedMatches?: ForfeitedMatch[];
  initialColour?: 'B' | 'W';
  numberOfPlayers?: number;
  numberOfRatedPlayers?: number;
  numberOfTeams?: number;
  onWarning?: (warning: ParseWarning) => void;
  outOfOrderLineups?: OutOfOrderLineup[];
  standingsTiebreaks?: string[];
  teamPairingAllocatedByes?: TeamPairingAllocatedBye;
  teamRoundResults?: TeamRoundResult[];
  teamScoringSystem?: string;
  useRankingId?: boolean;
  version?: Version;
}

export type {
  AbnormalPoints,
  ForfeitedMatch,
  OutOfOrderLineup,
  ParseError,
  ParseOptions,
  ParseWarning,
  ResultCode,
  StringifyOptions,
  TeamPairingAllocatedBye,
  TeamRoundResult,
  TeamRoundResult801,
  TeamRoundResult802,
  TrfBye,
  Version,
};

export {
  type AcceleratedRound,
  type Bye,
  type CompletedRound,
  type Game,
  type NationalRating,
  type Player,
  type PlayerAcceleration,
  type PointAdjustment,
  type ProhibitedPairing,
  type ScoringSystem,
  type Team,
  type TournamentData,
  type TournamentMetadata,
} from '@echecs/tournament';
