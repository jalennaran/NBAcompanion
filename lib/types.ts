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
  venue?: {
    id: string;
    fullName: string;
    address: {
      city: string;
      state: string;
    };
  };
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
  spread: number;
  moneyline?: {
    home?: {
      close?: {
        odds: string;
      };
    };
    away?: {
      close?: {
        odds: string;
      };
    };
  };
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
  lastFiveGames?: any[];
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
    starter: boolean;
    didNotPlay?: boolean;
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
  scoreValue?: number;
  shootingPlay: boolean;
  coordinate?: {
    x: number;
    y: number;
  };
  team?: {
    id: string;
  };
  participants?: {
    athlete: {
      id: string;
    };
  }[];
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

export interface GamePrediction {
  game_date: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  home_team_full: string;
  away_team_full: string;
  pred_home_score: number;
  pred_away_score: number;
  simulation?: {
    margin: { mean: number; p10: number; p25: number; p75: number; p90: number };
    total:  { mean: number; p10: number; p25: number; p75: number; p90: number };
  };
  feature_importances?: {
    margin_model: Array<{ feature: string; contribution: number; value: number | null }>;
    total_model:  Array<{ feature: string; contribution: number; value: number | null }>;
  };
  spread: {
    line: number;
    predicted_margin: number;
    home_cover_pct: number;
    away_cover_pct: number;
    push_pct: number;
    bet_side: string;
    bet_edge: number;
    bet_flag: boolean;
    ev?: number;
    kelly_units?: number;
  };
  moneyline: {
    ml_home: number;
    ml_away: number;
    predicted_home_win_pct: number;
    predicted_away_win_pct: number;
    home_win_pct: number;
    away_win_pct: number;
    implied_home_pct: number;
    implied_away_pct: number;
    bet_side: string;
    bet_edge: number;
    bet_flag: boolean;
    confidence?: 'strong' | 'value' | 'longshot' | 'none';
    ev?: number;
    kelly_units?: number;
  };
  over_under: {
    line: number;
    predicted_total: number;
    over_pct: number;
    under_pct: number;
    push_pct: number;
    bet_side: string;
    bet_edge: number;
    bet_flag: boolean;
    ev?: number;
    kelly_units?: number;
  };
}

export interface PredictionsFile {
  generated_at: string;
  game_date: string;
  games: GamePrediction[];
}
