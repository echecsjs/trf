type ResultCode = '+' | '-' | '0' | '1' | '=' | 'F' | 'H' | 'U' | 'Z';

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

interface Player {
  birthDate?: string;
  federation?: string;
  fideId?: string;
  name: string;
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

interface Tournament {
  chiefArbiter?: string;
  city?: string;
  comments?: string[];
  deputyArbiters?: string[];
  endDate?: string;
  federation?: string;
  name?: string;
  numberOfPlayers?: number;
  numberOfRatedPlayers?: number;
  numberOfTeams?: number;
  players: Player[];
  rounds: number;
  startDate?: string;
  timeControl?: string;
  tournamentType?: string;
  version: Version;
}

export type {
  ParseError,
  ParseOptions,
  ParseWarning,
  Player,
  ResultCode,
  RoundResult,
  Sex,
  StringifyOptions,
  Title,
  Tournament,
  Version,
};
