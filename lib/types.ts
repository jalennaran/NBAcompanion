// ESPN API Types
export interface Game {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  competitions: Competition[];
  status: GameStatus;
  links: Link[];
}

export interface Competition {
  id: string;
  date: string;
  attendance: number;
  competitors: Competitor[];
  status: GameStatus;
  broadcasts: Broadcast[];
  situation?: GameSituation;
  odds?: Odds[];
}

export interface Competitor {
  id: string;
  uid: string;
  type: string;
  order: number;
  homeAway: 'home' | 'away';
  team: Team;
  score: string;
  linescores: LineScore[];
  statistics: Statistic[];
  leaders: Leader[];
  records: Record[];
}

export interface Team {
  id: string;
  uid: string;
  location: string;
  name: string;
  abbreviation: string;
  displayName: string;
  shortDisplayName: string;
  color: string;
  alternateColor: string;
  logo: string;
}

export interface LineScore {
  value: number;
  displayValue: string;
  period: number;
}

export interface Statistic {
  name: string;
  abbreviation: string;
  displayValue: string;
}

export interface Leader {
  name: string;
  displayName: string;
  shortDisplayName: string;
  abbreviation: string;
  leaders: LeaderAthlete[];
}

export interface LeaderAthlete {
  displayValue: string;
  value: number;
  athlete: Athlete;
}

export interface Athlete {
  id: string;
  fullName: string;
  displayName: string;
  shortName: string;
  headshot: string;
  jersey: string;
  position: {
    abbreviation: string;
  };
}

export interface Record {
  name: string;
  abbreviation?: string;
  type: string;
  summary: string;
}

export interface GameStatus {
  clock: number;
  displayClock: string;
  period: number;
  type: {
    id: string;
    name: string;
    state: string;
    completed: boolean;
    description: string;
    detail: string;
    shortDetail: string;
  };
}

export interface Broadcast {
  market: string;
  names: string[];
}

export interface GameSituation {
  lastPlay: {
    id: string;
    type: {
      id: string;
      text: string;
    };
    text: string;
    scoreValue: number;
    probability?: {
      tiePercentage: number;
      homeWinPercentage: number;
      awayWinPercentage: number;
    };
  };
}

export interface Odds {
  provider: {
    id: string;
    name: string;
    priority: number;
  };
  details: string;
  overUnder: number;
}

export interface Link {
  language: string;
  rel: string[];
  href: string;
  text: string;
  shortText: string;
  isExternal: boolean;
  isPremium: boolean;
}

export interface ScoreboardResponse {
  leagues: any[];
  events: Game[];
}

export interface GameSummary {
  boxscore: {
    teams: any[];
    players: TeamBoxScore[];
  };
  header: {
    competitions: Competition[];
  };
  plays: Play[];
  winprobability: WinProbability[];
  leaders: Leader[];
  gameInfo: GameInfo;
  odds: Odds[];
}

export interface TeamBoxScore {
  team: Team;
  statistics: PlayerStatistics[];
}

export interface PlayerStatistics {
  names: string[];
  athletes: {
    athlete: Athlete;
    stats: string[];
  }[];
}

export interface Play {
  id: string;
  sequenceNumber: string;
  type: {
    id: string;
    text: string;
  };
  text: string;
  awayScore: number;
  homeScore: number;
  period: {
    number: number;
  };
  clock: {
    displayValue: string;
  };
  scoringPlay: boolean;
  shootingPlay: boolean;
  coordinate?: {
    x: number;
    y: number;
  };
}

export interface WinProbability {
  tiePercentage: number;
  homeWinPercentage: number;
  awayWinPercentage: number;
  playId: string;
}

export interface GameInfo {
  venue: {
    id: string;
    fullName: string;
    address: {
      city: string;
      state: string;
    };
  };
  attendance: number;
  officials: Official[];
}

export interface Official {
  fullName: string;
  displayName: string;
  position: {
    name: string;
  };
}
