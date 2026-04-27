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
export async function fetchPredictions(): Promise<PredictionsFile[] | null> {
  try {
    const response = await fetch('/api/predictions', { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    // Support both array (new format) and single object (legacy format)
    return Array.isArray(data) ? data : [data];
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

// Fetch player bio (height, weight, position, jersey, draft, DOB, headshot)

export async function fetchPlayerBio(athleteId: string): Promise<any> {
  const response = await fetch(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${athleteId}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch bio for athlete ${athleteId}`);
  }

  return response.json();
}

// Fetch player game log (full season, per-game stats)

export async function fetchPlayerGameLog(athleteId: string): Promise<any> {
  const response = await fetch(
    `https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${athleteId}/gamelog`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch game log for athlete ${athleteId}`);
  }

  return response.json();
}

// Fetch team profile (record, conference, standings)

export async function fetchTeamProfile(teamId: string): Promise<any> {
  const response = await fetch(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}`,
    { cache: 'no-store' }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch profile for team ${teamId}`);
  }

  return response.json();
}

// Fetch full-season team schedule (regular season + playoffs combined)

export async function fetchTeamSchedule(teamId: string): Promise<any> {
  const base = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/schedule`;
  const [reg, post] = await Promise.all([
    fetch(`${base}?seasontype=2`, { cache: 'no-store' }),
    fetch(`${base}?seasontype=3`, { cache: 'no-store' }),
  ]);

  const regData  = reg.ok  ? await reg.json()  : { events: [] };
  const postData = post.ok ? await post.json() : { events: [] };

  return {
    ...regData,
    events: [...(regData.events ?? []), ...(postData.events ?? [])],
  };
}
