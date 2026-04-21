import { ScoreboardResponse, GameSummary, PredictionsFile } from './types';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';


// Fetch today's scoreboard with all games

export async function getScoreboard(): Promise<ScoreboardResponse> {
  const response = await fetch(`${ESPN_API_BASE}/scoreboard`, {
    next: { revalidate: 5 }, // Cache for 5 seconds
  });

  if (!response.ok) {
    throw new Error('Failed to fetch scoreboard');
  }

  return response.json();
}

// Fetch detailed game summary including play-by-play

export async function getGameSummary(eventId: string): Promise<GameSummary> {
  const response = await fetch(`${ESPN_API_BASE}/summary?event=${eventId}`, {
    next: { revalidate: 5 }, // Cache for 5 seconds
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch game summary for event ${eventId}`);
  }

  return response.json();
}

// Fetch scoreboard for client-side with no caching
// Optional date param in YYYYMMDD format

export async function fetchScoreboard(date?: string): Promise<ScoreboardResponse> {
  const url = date
    ? `${ESPN_API_BASE}/scoreboard?dates=${date}`
    : `${ESPN_API_BASE}/scoreboard`;
  const response = await fetch(url, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch scoreboard');
  }

  return response.json();
}

// Fetch game summary for client-side with no caching

export async function fetchGameSummary(eventId: string): Promise<GameSummary> {
  const response = await fetch(`${ESPN_API_BASE}/summary?event=${eventId}`, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch game summary for event ${eventId}`);
  }

  return response.json();
}

// Fetch season stats for a single athlete

export async function fetchPlayerStats(athleteId: string): Promise<any> {
  const response = await fetch(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${athleteId}/overview`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch stats for athlete ${athleteId}`);
  }

  return response.json();
}

// Fetch today's game predictions
export async function fetchPredictions(): Promise<PredictionsFile | null> {
  try {
    const response = await fetch('/api/predictions', { cache: 'no-store' });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

// Fetch team roster with season averages

export async function fetchTeamRoster(teamId: string): Promise<any> {
  const response = await fetch(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/teams/${teamId}/roster`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch roster for team ${teamId}`);
  }

  return response.json();
}
