'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchGameSummary, fetchTeamRoster, fetchPredictions } from '@/lib/api';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Competitor, Play, TeamBoxScore, GamePrediction } from '@/lib/types';
import CourtStrip from '@/components/game/CourtStrip';
import type { OnCourtPlayer } from '@/components/game/CourtStrip';
import { ThreeCourtScene } from '@/components/three-court/ThreeCourtScene';

export default function GamePage() {
  const params = useParams();
  const gameId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['gameSummary', gameId],
    queryFn: () => fetchGameSummary(gameId),
    enabled: !!gameId,
    // Poll play-by-play more frequently so we catch every shot
    refetchInterval: 2 * 1000,
    staleTime: 1 * 1000,
  });

  // Derive pregame state and team IDs before hooks (to keep hook order stable)
  const competition = data?.header?.competitions?.[0];
  const gameStatus = competition?.status;
  const isPregame = gameStatus?.type?.state === 'pre';
  const isLive = gameStatus?.type?.state === 'in';
  const isFinal = gameStatus?.type?.completed;

  // Build a logo lookup from boxscore.teams (header data often omits logos)
  const logoById: Record<string, string> = {};
  (data?.boxscore?.teams ?? []).forEach((t: any) => {
    if (t.team?.id && t.team?.logo) logoById[t.team.id] = t.team.logo;
  });

  // Enrich header competitors with logos from boxscore when missing
  const enrichLogo = (c: Competitor | undefined): Competitor | undefined => {
    if (!c) return c;
    if (!c.team.logo && logoById[c.team.id]) {
      return { ...c, team: { ...c.team, logo: logoById[c.team.id] } };
    }
    return c;
  };

  const homeCompetitor = enrichLogo(
    competition?.competitors?.find((c: Competitor) => c.homeAway === 'home')
  );
  const awayCompetitor = enrichLogo(
    competition?.competitors?.find((c: Competitor) => c.homeAway === 'away')
  );

  // --- Pregame: fetch last-game starters + rosters with season averages ---
  const lastFiveGames = data?.lastFiveGames ?? [];
  const awayLastGameId = lastFiveGames.find(
    (t: any) => t.team?.id === awayCompetitor?.team?.id
  )?.events?.[0]?.id as string | undefined;
  const homeLastGameId = lastFiveGames.find(
    (t: any) => t.team?.id === homeCompetitor?.team?.id
  )?.events?.[0]?.id as string | undefined;

  const { data: awayLastGame } = useQuery({
    queryKey: ['lastGame', awayLastGameId],
    queryFn: () => fetchGameSummary(awayLastGameId!),
    enabled: isPregame && !!awayLastGameId,
    staleTime: Infinity,
  });
  const { data: homeLastGame } = useQuery({
    queryKey: ['lastGame', homeLastGameId],
    queryFn: () => fetchGameSummary(homeLastGameId!),
    enabled: isPregame && !!homeLastGameId,
    staleTime: Infinity,
  });

  const { data: awayRoster } = useQuery({
    queryKey: ['roster', awayCompetitor?.team?.id],
    queryFn: () => fetchTeamRoster(awayCompetitor!.team.id),
    enabled: isPregame && !!awayCompetitor?.team?.id,
    staleTime: Infinity,
  });
  const { data: homeRoster } = useQuery({
    queryKey: ['roster', homeCompetitor?.team?.id],
    queryFn: () => fetchTeamRoster(homeCompetitor!.team.id),
    enabled: isPregame && !!homeCompetitor?.team?.id,
    staleTime: Infinity,
  });

  const { data: predictionsData } = useQuery({
    queryKey: ['predictions'],
    queryFn: fetchPredictions,
    staleTime: 5 * 60 * 1000,
  });

  const ESPN_TO_NBA_ABBR: Record<string, string> = {
    GS: 'GSW',
    NO: 'NOP',
    NY: 'NYK',
    SA: 'SAS',
    UTAH: 'UTA',
    WSH: 'WAS',
  };

  const normalizeTeamAbbreviation = (abbr?: string): string | undefined => {
    if (!abbr) return abbr;
    return ESPN_TO_NBA_ABBR[abbr] ?? abbr;
  };

  const normalizedHomeAbbr = normalizeTeamAbbreviation(homeCompetitor?.team?.abbreviation);
  const normalizedAwayAbbr = normalizeTeamAbbreviation(awayCompetitor?.team?.abbreviation);

  const gamePrediction: GamePrediction | null =
    predictionsData?.games.find(
      (g) =>
        g.home_team === normalizedHomeAbbr &&
        g.away_team === normalizedAwayAbbr
    ) ?? null;

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto">
          <BackLink />
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-slate-400 text-lg">Loading game data...</div>
          </div>
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto">
          <BackLink />
          <p className="text-red-400 bg-red-950/30 backdrop-blur-sm p-6 rounded-2xl border border-red-900/50">
            Error loading game data: {error?.message ?? 'Unknown error'}
          </p>
        </div>
      </main>
    );
  }

  // Box score data
  const awayBoxScore = data.boxscore?.players?.find(
    (p: TeamBoxScore) => p.team.id === awayCompetitor?.team?.id
  );
  const homeBoxScore = data.boxscore?.players?.find(
    (p: TeamBoxScore) => p.team.id === homeCompetitor?.team?.id
  );

  // Plays sorted most recent first
  const plays = [...(data.plays ?? [])].reverse();

  // Most recent shot play (made or missed, including free throws) for the court banner
  const lastShotPlay = [...(data.plays ?? [])].reverse().find(
    (p) => p.shootingPlay || /free.?throw/i.test(p.type?.text ?? '')
  );

  // Build athlete lookup by ID (from both teams' boxscore data)
  const athleteById: Record<string, OnCourtPlayer> = {};
  [awayBoxScore, homeBoxScore].forEach((bs) => {
    if (!bs) return;
    for (const a of bs.statistics?.[0]?.athletes ?? []) {
      athleteById[a.athlete.id] = {
        name: a.athlete.shortName || a.athlete.displayName,
        jersey: a.athlete.jersey,
        position: a.athlete.position?.abbreviation,
        headshotUrl: typeof a.athlete.headshot === 'string'
          ? a.athlete.headshot
          : (a.athlete.headshot as any)?.href,
      };
    }
  });

  // Derive current on-court lineups by replaying substitutions
  const deriveOnCourt = (teamId: string, boxScore?: TeamBoxScore): OnCourtPlayer[] => {
    if (!boxScore) return [];
    // Start with starters
    const starterIds = new Set(
      (boxScore.statistics?.[0]?.athletes ?? [])
        .filter((a) => a.starter)
        .map((a) => a.athlete.id)
    );
    const onCourtIds = new Set(starterIds);

    // Process substitution plays in chronological order
    const allPlays = data.plays ?? [];
    for (const play of allPlays) {
      if (
        play.type?.text === 'Substitution' &&
        (play as any).team?.id === teamId &&
        (play as any).participants?.length === 2
      ) {
        const enteringId = (play as any).participants[0]?.athlete?.id;
        const leavingId = (play as any).participants[1]?.athlete?.id;
        if (enteringId) onCourtIds.add(String(enteringId));
        if (leavingId) onCourtIds.delete(String(leavingId));
      }
    }

    return Array.from(onCourtIds)
      .map((id) => athleteById[id])
      .filter(Boolean);
  };

  // --- Derive lineups: live on-court OR pregame projected starters ---
  const extractProjectedStarters = (
    lastGameData: any,
    teamId: string
  ): OnCourtPlayer[] => {
    if (!lastGameData) return [];
    const teamBox = (lastGameData.boxscore?.players ?? []).find(
      (p: any) => p.team?.id === teamId
    );
    if (!teamBox) return [];
    const athletes = teamBox.statistics?.[0]?.athletes ?? [];
    return athletes
      .filter((a: any) => a.starter)
      .map((a: any) => ({
        name: a.athlete.shortName || a.athlete.displayName,
        jersey: a.athlete.jersey,
        position: a.athlete.position?.abbreviation,
        headshotUrl: typeof a.athlete.headshot === 'string'
          ? a.athlete.headshot
          : (a.athlete.headshot as any)?.href,
      }));
  };

  const awayOnCourt = isPregame
    ? extractProjectedStarters(awayLastGame, awayCompetitor?.team?.id ?? '')
    : deriveOnCourt(awayCompetitor?.team?.id ?? '', awayBoxScore);
  const homeOnCourt = isPregame
    ? extractProjectedStarters(homeLastGame, homeCompetitor?.team?.id ?? '')
    : deriveOnCourt(homeCompetitor?.team?.id ?? '', homeBoxScore);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto">
        <BackLink />

        {/* Quarter-by-quarter scoring breakdown */}
        <ScoreHeader
          homeCompetitor={homeCompetitor}
          awayCompetitor={awayCompetitor}
          gameStatus={gameStatus}
          isLive={isLive}
          isFinal={isFinal}
        />

        {/* Court visualization strip */}
        <CourtStrip
          homeTeamName={homeCompetitor?.team?.displayName ?? ''}
          homeTeamLogoUrl={homeCompetitor?.team?.logo ?? ''}
          awayTeamName={awayCompetitor?.team?.displayName ?? ''}
          awayTeamColor={awayCompetitor?.team?.color}
          homeTeamColor={homeCompetitor?.team?.color}
          awayOnCourt={awayOnCourt}
          homeOnCourt={homeOnCourt}
          panelLabel={isPregame ? 'Projected Starters' : undefined}
          className="mt-6"
        />

        {/* 3D court view — live shot markers and arc animations driven by play-by-play */}
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm">
          <ThreeCourtScene
            height={520}
            centerLogoUrl={homeCompetitor?.team?.logo}
            awayLogoUrl={awayCompetitor?.team?.logo}
            homeLogoUrl={homeCompetitor?.team?.logo}
            plays={data.plays}
            homeTeamId={homeCompetitor?.team?.id}
            homeColor={homeCompetitor?.team?.color}
            awayColor={awayCompetitor?.team?.color}
            isLive={isLive}
            boxscorePlayers={data.boxscore?.players}
          />
          {/* Latest shot banner — shown under the 3D canvas */}
          {lastShotPlay && (() => {
            const made = lastShotPlay.scoringPlay && (lastShotPlay.scoreValue ?? 0) >= 1;
            const isFT = /free.?throw/i.test(lastShotPlay.type?.text ?? '');
            const periodLabel = lastShotPlay.period.number <= 4
              ? `Q${lastShotPlay.period.number}`
              : `OT${lastShotPlay.period.number - 4}`;
            return (
              <div
                className={`flex items-center gap-3 px-5 py-3 border-t ${
                  made
                    ? 'border-emerald-700/40 bg-emerald-950/30'
                    : 'border-red-800/40 bg-red-950/25'
                }`}
              >
                {/* Result icon */}
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-black ${
                    made ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                  }`}
                >
                  {made ? '✓' : '✗'}
                </span>

                {/* Play description */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    made ? 'text-emerald-200' : 'text-red-200'
                  }`}>
                    {lastShotPlay.text}
                  </p>
                </div>

                {/* Period + score */}
                <div className="flex-shrink-0 text-right">
                  <span className="text-xs text-slate-500 font-mono block">
                    {periodLabel} {lastShotPlay.clock.displayValue}
                  </span>
                  {made && (
                    <span className="text-xs font-bold font-mono text-slate-300 block mt-0.5">
                      <span style={{ color: awayCompetitor?.team?.color ? `#${awayCompetitor.team.color}` : undefined }}>
                        {awayCompetitor?.team?.abbreviation} {lastShotPlay.awayScore}
                      </span>
                      <span className="text-slate-600 mx-1">–</span>
                      <span style={{ color: homeCompetitor?.team?.color ? `#${homeCompetitor.team.color}` : undefined }}>
                        {lastShotPlay.homeScore} {homeCompetitor?.team?.abbreviation}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Three-column layout: Away Box | Play-by-Play | Home Box */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(360px,480px)_1fr] gap-4 mt-6">
          {/* Away team box score */}
          <div className="order-2 xl:order-1">
            {isPregame ? (
              <PregameRosterTable roster={awayRoster} competitor={awayCompetitor} label="away" />
            ) : (
              <BoxScoreTable teamBoxScore={awayBoxScore} competitor={awayCompetitor} label="away" />
            )}
          </div>

          {/* Center panel: predictions pregame/postgame, play-by-play during */}
          <div className="order-1 xl:order-2">
            {isLive ? (
              <PlayByPlayFeed
                plays={plays}
                homeAbbrev={homeCompetitor?.team?.abbreviation ?? ''}
                awayAbbrev={awayCompetitor?.team?.abbreviation ?? ''}
                homeColor={homeCompetitor?.team?.color}
                awayColor={awayCompetitor?.team?.color}
              />
            ) : (
              <GamePredictionsPanel
                prediction={gamePrediction}
                homeCompetitor={homeCompetitor}
                awayCompetitor={awayCompetitor}
                isFinal={isFinal}
              />
            )}
          </div>

          {/* Home team box score */}
          <div className="order-3">
            {isPregame ? (
              <PregameRosterTable roster={homeRoster} competitor={homeCompetitor} label="home" />
            ) : (
              <BoxScoreTable teamBoxScore={homeBoxScore} competitor={homeCompetitor} label="home" />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* ─── Back Link ──────────────────────────────────────────────────────── */

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-6 text-sm"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Back to Scoreboard
    </Link>
  );
}

/* ─── Score Header (quarter-by-quarter breakdown) ────────────────────── */

function ScoreHeader({
  homeCompetitor,
  awayCompetitor,
  gameStatus,
  isLive,
  isFinal,
}: {
  homeCompetitor?: Competitor;
  awayCompetitor?: Competitor;
  gameStatus?: any;
  isLive?: boolean;
  isFinal?: boolean;
}) {
  if (!homeCompetitor || !awayCompetitor) return null;

  const maxPeriods = Math.max(
    homeCompetitor.linescores?.length ?? 0,
    awayCompetitor.linescores?.length ?? 0,
    4
  );

  const periodHeaders: string[] = [];
  for (let i = 1; i <= maxPeriods; i++) {
    periodHeaders.push(i <= 4 ? String(i) : `OT${i - 4}`);
  }

  const homeTotal = parseInt(homeCompetitor.score || '0');
  const awayTotal = parseInt(awayCompetitor.score || '0');
  const homeWon = isFinal && homeTotal > awayTotal;
  const awayWon = isFinal && awayTotal > homeTotal;

  return (
    <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-3xl p-5 md:p-6 border border-slate-700/50">
      {/* Status badge */}
      <div className="flex items-center justify-center mb-4">
        {isLive ? (
          <div className="flex items-center gap-2 bg-red-500/20 px-4 py-1.5 rounded-full border border-red-500/50">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-xs font-bold uppercase tracking-wider">
              {gameStatus?.type?.shortDetail}
            </span>
          </div>
        ) : isFinal ? (
          <div className="text-emerald-400 text-sm font-bold uppercase tracking-wider bg-emerald-500/10 px-4 py-1.5 rounded-full border border-emerald-500/30">
            Final
          </div>
        ) : (
          <div className="text-slate-400 text-sm font-medium">
            {gameStatus?.type?.shortDetail}
          </div>
        )}
      </div>

      {/* Score table */}
      <div className="overflow-x-auto">
        <table className="w-full max-w-2xl mx-auto text-sm">
          <thead>
            <tr className="text-slate-500 text-xs uppercase tracking-wider">
              <th className="text-left py-2 pr-4 w-56"></th>
              {periodHeaders.map((h) => (
                <th key={h} className="text-center px-3 py-2 w-12">{h}</th>
              ))}
              <th className="text-center px-3 py-2 w-16 text-slate-300 font-bold">T</th>
            </tr>
          </thead>
          <tbody>
            {/* Away team row */}
            <TeamScoreRow
              competitor={awayCompetitor}
              maxPeriods={maxPeriods}
              isWinner={awayWon}
            />
            {/* Home team row */}
            <TeamScoreRow
              competitor={homeCompetitor}
              maxPeriods={maxPeriods}
              isWinner={homeWon}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TeamScoreRow({
  competitor,
  maxPeriods,
  isWinner,
}: {
  competitor: Competitor;
  maxPeriods: number;
  isWinner?: boolean;
}) {
  const total = parseInt(competitor.score || '0');

  return (
    <tr className="border-t border-slate-700/40">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
            {competitor.team.logo ? (
              <Image
                src={competitor.team.logo}
                alt={competitor.team.abbreviation}
                width={32}
                height={32}
                className="object-contain"
              />
            ) : (
              <span className="text-xs font-bold text-slate-400">{competitor.team.abbreviation}</span>
            )}
          </div>
          <div>
            <span className={`font-bold ${isWinner ? 'text-white' : 'text-slate-300'}`}>
              {competitor.team.displayName}
            </span>
            {competitor.records?.[0] && (
              <span className="text-slate-500 text-xs ml-2">
                ({competitor.records[0].summary}{competitor.records?.[1] ? `, ${competitor.records[1].summary} ${competitor.homeAway === 'home' ? 'Home' : 'Away'}` : ''})
              </span>
            )}
          </div>
        </div>
      </td>
      {Array.from({ length: maxPeriods }).map((_, i) => (
        <td key={i} className="text-center px-3 py-3 text-slate-400">
          {competitor.linescores?.[i]?.displayValue ?? '-'}
        </td>
      ))}
      <td className={`text-center px-3 py-3 font-black text-lg ${isWinner ? 'text-white' : 'text-slate-300'}`}>
        {total}
        {isWinner && (
          <span className="text-xs ml-1 text-emerald-400">◀</span>
        )}
      </td>
    </tr>
  );
}

/* ─── Play-by-Play Feed ──────────────────────────────────────────────── */

function PlayByPlayFeed({
  plays,
  homeAbbrev,
  awayAbbrev,
  homeColor,
  awayColor,
}: {
  plays: Play[];
  homeAbbrev: string;
  awayAbbrev: string;
  homeColor?: string;
  awayColor?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 flex flex-col h-[700px]">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700/50">
        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <h2 className="text-white font-bold text-sm uppercase tracking-wider">Play-by-Play</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-subtle">
        {plays.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            No plays available yet
          </div>
        ) : (
          plays.map((play) => (
            <PlayItem
              key={play.id}
              play={play}
              homeAbbrev={homeAbbrev}
              awayAbbrev={awayAbbrev}
              homeColor={homeColor}
              awayColor={awayColor}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PlayItem({
  play,
  homeAbbrev,
  awayAbbrev,
  homeColor,
  awayColor,
}: {
  play: Play;
  homeAbbrev: string;
  awayAbbrev: string;
  homeColor?: string;
  awayColor?: string;
}) {
  const periodLabel = play.period.number <= 4
    ? `Q${play.period.number}`
    : `OT${play.period.number - 4}`;

  const isScoringPlay = play.scoringPlay;

  return (
    <div
      className={`px-3 py-2 rounded-xl text-sm transition-colors ${
        isScoringPlay
          ? 'bg-emerald-900/20 border border-emerald-500/20'
          : 'hover:bg-slate-700/30'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Time */}
        <div className="flex-shrink-0 text-xs text-slate-500 w-16 pt-0.5 text-right font-mono">
          {periodLabel} {play.clock.displayValue}
        </div>

        {/* Play text */}
        <div className="flex-1 min-w-0">
          <p className={`leading-relaxed ${isScoringPlay ? 'text-emerald-200' : 'text-slate-300'}`}>
            {play.text}
          </p>
        </div>

        {/* Score */}
        {isScoringPlay && (
          <div className="flex-shrink-0 text-xs font-mono font-bold text-slate-300 whitespace-nowrap pt-0.5">
            <span style={{ color: awayColor ? `#${awayColor}` : undefined }}>
              {awayAbbrev} {play.awayScore}
            </span>
            <span className="text-slate-600 mx-1">-</span>
            <span style={{ color: homeColor ? `#${homeColor}` : undefined }}>
              {play.homeScore} {homeAbbrev}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Game Predictions Panel ─────────────────────────────────────────── */

function GamePredictionsPanel({
  prediction,
  homeCompetitor,
  awayCompetitor,
  isFinal,
}: {
  prediction: GamePrediction | null;
  homeCompetitor?: Competitor;
  awayCompetitor?: Competitor;
  isFinal?: boolean;
}) {
  const fmtOdds = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 flex flex-col h-[700px]">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-700/50">
        <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <h2 className="text-white font-bold text-sm uppercase tracking-wider">Game Predictions</h2>
        {isFinal && (
          <span className="ml-auto text-xs text-emerald-400 font-semibold uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
            Final Results
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-subtle">
        {!prediction ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            No predictions available for this game
          </div>
        ) : (
          <>
            {/* Predicted score */}
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/40">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-3 font-bold">Predicted Score</p>
              <div className="space-y-2">
                {[
                  { competitor: awayCompetitor, predScore: prediction.pred_away_score },
                  { competitor: homeCompetitor, predScore: prediction.pred_home_score },
                ].map(({ competitor, predScore }) => {
                  const actual = competitor?.score ? parseInt(competitor.score) : null;
                  const diff = actual !== null ? actual - Math.round(predScore) : null;
                  return (
                    <div key={competitor?.team?.id} className="flex items-center gap-3">
                      {competitor?.team?.logo && (
                        <Image src={competitor.team.logo} alt={competitor.team.abbreviation} width={24} height={24} className="object-contain flex-shrink-0" />
                      )}
                      <span className="text-slate-300 font-medium text-sm flex-1">{competitor?.team?.abbreviation}</span>
                      <span className="text-slate-400 text-sm font-mono">{predScore.toFixed(1)}</span>
                      {isFinal && actual !== null && (
                        <>
                          <span className="text-slate-600 text-xs">→</span>
                          <span className="text-white font-bold text-sm font-mono w-8 text-right">{actual}</span>
                          <span className={`text-xs font-mono w-10 text-right ${diff! > 0 ? 'text-emerald-400' : diff! < 0 ? 'text-red-400' : 'text-slate-500'}`}>
                            {diff! > 0 ? `+${diff}` : diff}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Win probability bar */}
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/40">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-3 font-bold">Win Probability</p>
              <div className="flex items-center gap-2 text-xs font-mono mb-2">
                <span style={{ color: awayCompetitor?.team?.color ? `#${awayCompetitor.team.color}` : undefined }} className="text-slate-300 font-bold w-10">
                  {fmtPct(prediction.moneyline.predicted_away_win_pct)}
                </span>
                <div className="flex-1 h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${prediction.moneyline.predicted_away_win_pct}%`,
                      background: awayCompetitor?.team?.color ? `#${awayCompetitor.team.color}` : '#94a3b8',
                    }}
                  />
                </div>
                <span style={{ color: homeCompetitor?.team?.color ? `#${homeCompetitor.team.color}` : undefined }} className="text-slate-300 font-bold w-10 text-right">
                  {fmtPct(prediction.moneyline.predicted_home_win_pct)}
                </span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{awayCompetitor?.team?.abbreviation}</span>
                <span>{homeCompetitor?.team?.abbreviation}</span>
              </div>
            </div>

            {/* Moneyline */}
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/40">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Moneyline</p>
                {prediction.moneyline.bet_flag && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-wider">
                    ★ Value Bet: {prediction.moneyline.bet_side === 'home' ? homeCompetitor?.team?.abbreviation : awayCompetitor?.team?.abbreviation}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: awayCompetitor?.team?.abbreviation ?? 'Away', odds: prediction.moneyline.ml_away, winPct: prediction.moneyline.predicted_away_win_pct, impliedPct: prediction.moneyline.implied_away_pct, color: awayCompetitor?.team?.color },
                  { label: homeCompetitor?.team?.abbreviation ?? 'Home', odds: prediction.moneyline.ml_home, winPct: prediction.moneyline.predicted_home_win_pct, impliedPct: prediction.moneyline.implied_home_pct, color: homeCompetitor?.team?.color },
                ].map(({ label, odds, winPct, impliedPct, color }) => (
                  <div key={label} className="bg-slate-900/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                    <p className="text-lg font-black font-mono" style={{ color: color ? `#${color}` : undefined }}>{fmtOdds(odds)}</p>
                    <p className="text-xs text-slate-400 mt-1">Pred: <span className="text-slate-200">{fmtPct(winPct)}</span></p>
                    <p className="text-xs text-slate-600">Implied: {fmtPct(impliedPct)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Spread */}
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/40">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Spread</p>
                {prediction.spread.bet_flag && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-wider">
                    ★ Value Bet: {prediction.spread.bet_side === 'home' ? homeCompetitor?.team?.abbreviation : awayCompetitor?.team?.abbreviation}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: awayCompetitor?.team?.abbreviation ?? 'Away', line: -prediction.spread.line, coverPct: prediction.spread.away_cover_pct, color: awayCompetitor?.team?.color },
                  { label: homeCompetitor?.team?.abbreviation ?? 'Home', line: prediction.spread.line, coverPct: prediction.spread.home_cover_pct, color: homeCompetitor?.team?.color },
                ].map(({ label, line, coverPct, color }) => (
                  <div key={label} className="bg-slate-900/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                    <p className="text-lg font-black font-mono" style={{ color: color ? `#${color}` : undefined }}>
                      {line > 0 ? `+${line}` : line}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Cover: <span className="text-slate-200">{fmtPct(coverPct)}</span></p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Predicted margin: <span className="text-slate-300 font-mono">{prediction.spread.predicted_margin.toFixed(1)}</span></p>
            </div>

            {/* Over/Under */}
            <div className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/40">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Over / Under</p>
                {prediction.over_under.bet_flag && (
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-wider">
                    ★ Value: {prediction.over_under.bet_side.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex items-end gap-4 mb-3">
                <div>
                  <p className="text-[10px] text-slate-500">Line</p>
                  <p className="text-2xl font-black text-white font-mono">{prediction.over_under.line}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Predicted Total</p>
                  <p className="text-2xl font-black text-slate-300 font-mono">{prediction.over_under.predicted_total.toFixed(1)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Over', pct: prediction.over_under.over_pct },
                  { label: 'Under', pct: prediction.over_under.under_pct },
                ].map(({ label, pct }) => (
                  <div key={label} className="bg-slate-900/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                    <p className={`text-lg font-black font-mono ${label.toLowerCase() === prediction.over_under.bet_side ? 'text-amber-400' : 'text-slate-300'}`}>
                      {fmtPct(pct)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Box Score Table ────────────────────────────────────────────────── */

function BoxScoreTable({
  teamBoxScore,
  competitor,
  label,
}: {
  teamBoxScore?: TeamBoxScore;
  competitor?: Competitor;
  label: 'home' | 'away';
}) {
  if (!teamBoxScore || !competitor) {
    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6">
        <div className="text-slate-500 text-sm text-center">Box score not available</div>
      </div>
    );
  }

  // The statistics array usually has one entry for all players
  const playerStats = teamBoxScore.statistics?.[0];
  if (!playerStats) {
    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6">
        <div className="text-slate-500 text-sm text-center">Box score not available</div>
      </div>
    );
  }

  // Column headers from the API (MIN, FG, 3PT, FT, OREB, DREB, REB, AST, STL, BLK, TO, PF, +/-, PTS)
  const columns = playerStats.names ?? [];
  // Key columns to show (subset for readability)
  const keyColumns = ['MIN', 'PTS', 'REB', 'AST', 'FG', '3PT', 'FT', 'STL', 'BLK', 'TO', '+/-'];
  const columnIndices = keyColumns
    .map((col) => ({ name: col, index: columns.indexOf(col) }))
    .filter((c) => c.index !== -1);

  const athletes = playerStats.athletes ?? [];

  // Separate starters (first 5) and bench
  const starters = athletes.filter((a) => a.starter);
  const bench = athletes.filter((a) => !a.starter);
  const hasStarterFlag = starters.length > 0;

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 overflow-hidden">
      {/* Team header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50">
        <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
          {competitor.team.logo ? (
            <Image
              src={competitor.team.logo}
              alt={competitor.team.abbreviation}
              width={32}
              height={32}
              className="object-contain"
            />
          ) : (
            <span className="text-xs font-bold text-slate-400">{competitor.team.abbreviation}</span>
          )}
        </div>
        <div>
          <h2 className="text-white font-bold text-sm uppercase tracking-wider">
            {competitor.team.displayName}
          </h2>
          <span className="text-slate-500 text-xs">
            {label === 'home' ? 'Home' : 'Away'}
          </span>
        </div>
      </div>

      {/* Stats table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
              <th className="text-left py-2 px-3 sticky left-0 bg-slate-900/90 backdrop-blur-sm min-w-[120px]">Player</th>
              {columnIndices.map((col) => (
                <th key={col.name} className="text-center py-2 px-2 whitespace-nowrap">{col.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasStarterFlag && (
              <tr>
                <td
                  colSpan={columnIndices.length + 1}
                  className="text-[10px] text-slate-500 uppercase tracking-widest px-3 py-1 bg-slate-800/40 font-bold"
                >
                  Starters
                </td>
              </tr>
            )}
            {(hasStarterFlag ? starters : athletes).map((a) => (
              <PlayerRow
                key={a.athlete.id}
                athlete={a.athlete}
                stats={a.stats}
                columnIndices={columnIndices}
              />
            ))}
            {hasStarterFlag && bench.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={columnIndices.length + 1}
                    className="text-[10px] text-slate-500 uppercase tracking-widest px-3 py-1 bg-slate-800/40 font-bold"
                  >
                    Bench
                  </td>
                </tr>
                {bench.map((a) => (
                  <PlayerRow
                    key={a.athlete.id}
                    athlete={a.athlete}
                    stats={a.stats}
                    columnIndices={columnIndices}
                  />
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({
  athlete,
  stats,
  columnIndices,
}: {
  athlete: { id: string; displayName: string; jersey?: string; shortName?: string };
  stats: string[];
  columnIndices: { name: string; index: number }[];
}) {
  // Detect DNP — if all stats are empty or dashes
  const isDNP = stats.length === 0 || stats.every((s) => s === '0' || s === '' || s === '--');

  return (
    <tr className="border-t border-slate-700/20 hover:bg-slate-700/20 transition-colors">
      <td className="py-2 px-3 sticky left-0 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          {athlete.jersey && (
            <span className="text-slate-600 text-[10px] w-5 text-right">#{athlete.jersey}</span>
          )}
          <span className="text-slate-200 whitespace-nowrap font-medium">
            {athlete.shortName || athlete.displayName}
          </span>
        </div>
      </td>
      {isDNP ? (
        <td colSpan={columnIndices.length} className="text-center py-2 text-slate-600 italic text-[10px]">
          DNP
        </td>
      ) : (
        columnIndices.map((col) => (
          <td
            key={col.name}
            className={`text-center py-2 px-2 whitespace-nowrap ${
              col.name === 'PTS' ? 'text-white font-bold' : 'text-slate-400'
            }`}
          >
            {stats[col.index] ?? '-'}
          </td>
        ))
      )}
    </tr>
  );
}

/* ─── Pregame Roster Table (season averages) ─────────────────────────── */

function PregameRosterTable({
  roster,
  competitor,
  label,
}: {
  roster: any;
  competitor?: Competitor;
  label: 'home' | 'away';
}) {
  if (!competitor) {
    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6">
        <div className="text-slate-500 text-sm text-center">Roster not available</div>
      </div>
    );
  }

  // Extract all athletes from positionGroups
  const athletes: any[] = (roster?.positionGroups ?? []).flatMap(
    (g: any) => g.athletes ?? []
  );

  if (athletes.length === 0) {
    return (
      <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 p-6">
        <div className="text-slate-500 text-sm text-center">Roster not available</div>
      </div>
    );
  }

  // Stat columns we want to display
  const statColumns = ['PTS', 'REB', 'AST', 'FG%'] as const;

  // Extract stat map for a player
  const getStatMap = (athlete: any): Record<string, string> => {
    const cats = athlete?.statistics?.splits?.categories ?? [];
    const map: Record<string, string> = {};
    for (const cat of cats) {
      for (const s of cat.stats ?? []) {
        map[s.abbreviation] = s.displayValue;
      }
    }
    return map;
  };

  // Sort by PTS descending
  const sorted = [...athletes].sort((a, b) => {
    const aPts = parseFloat(getStatMap(a)['PTS'] ?? '0');
    const bPts = parseFloat(getStatMap(b)['PTS'] ?? '0');
    return bPts - aPts;
  });

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-700/50 overflow-hidden">
      {/* Team header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-700/50">
        <div className="relative w-8 h-8 flex-shrink-0 flex items-center justify-center">
          {competitor.team.logo ? (
            <Image
              src={competitor.team.logo}
              alt={competitor.team.abbreviation}
              width={32}
              height={32}
              className="object-contain"
            />
          ) : (
            <span className="text-xs font-bold text-slate-400">{competitor.team.abbreviation}</span>
          )}
        </div>
        <div>
          <h2 className="text-white font-bold text-sm uppercase tracking-wider">
            {competitor.team.displayName}
          </h2>
          <span className="text-slate-500 text-xs">
            {label === 'home' ? 'Home' : 'Away'} — Season Averages
          </span>
        </div>
      </div>

      {/* Stats table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 uppercase tracking-wider border-b border-slate-700/50">
              <th className="text-left py-2 px-3 sticky left-0 bg-slate-900/90 backdrop-blur-sm min-w-[120px]">Player</th>
              {statColumns.map((col) => (
                <th key={col} className="text-center py-2 px-2 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => {
              const statMap = getStatMap(a);
              const pos = a.position?.abbreviation ?? '';
              return (
                <tr key={a.id} className="border-t border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                  <td className="py-2 px-3 sticky left-0 bg-slate-900/80 backdrop-blur-sm">
                    <div className="flex items-center gap-2">
                      {a.jersey && (
                        <span className="text-slate-600 text-[10px] w-5 text-right">#{a.jersey}</span>
                      )}
                      <span className="text-slate-200 whitespace-nowrap font-medium">
                        {a.shortName || a.displayName}
                      </span>
                      {pos && (
                        <span className="text-slate-600 text-[10px]">{pos}</span>
                      )}
                    </div>
                  </td>
                  {statColumns.map((col) => (
                    <td
                      key={col}
                      className={`text-center py-2 px-2 whitespace-nowrap ${
                        col === 'PTS' ? 'text-white font-bold' : 'text-slate-400'
                      }`}
                    >
                      {statMap[col] ?? '-'}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
