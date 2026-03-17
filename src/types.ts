type ResultCode = '+' | '-' | '0' | '1' | '=' | 'F' | 'H' | 'U' | 'Z';

type Sex = 'f' | 'm';

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
  color: 'b' | 'w';
  opponentId: number | null;
  result: ResultCode;
  round: number;
}

interface Tournament {
  chiefArbiter?: string;
  city?: string;
  endDate?: string;
  federation?: string;
  name?: string;
  players: Player[];
  rounds: number;
  startDate?: string;
  timeControl?: string;
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
  Title,
  Tournament,
  Version,
};
