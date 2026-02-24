'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchGameSummary } from '@/lib/api';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import type { Competitor, Play, TeamBoxScore } from '@/lib/types';

export default function GamePage() {
  const params = useParams();
  const gameId = params.id as string;

  const { data, isLoading, error } = useQuery({
    queryKey: ['gameSummary', gameId],
    queryFn: () => fetchGameSummary(gameId),
    enabled: !!gameId,
  });

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

  const competition = data.header?.competitions?.[0];
  const gameStatus = competition?.status;
  const isLive = gameStatus?.type?.state === 'in';
  const isFinal = gameStatus?.type?.completed;

  // Build a logo lookup from boxscore.teams (header data often omits logos)
  const logoById: Record<string, string> = {};
  (data.boxscore?.teams ?? []).forEach((t: any) => {
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

  // Box score data
  const awayBoxScore = data.boxscore?.players?.find(
    (p: TeamBoxScore) => p.team.id === awayCompetitor?.team?.id
  );
  const homeBoxScore = data.boxscore?.players?.find(
    (p: TeamBoxScore) => p.team.id === homeCompetitor?.team?.id
  );

  // Plays sorted most recent first
  const plays = [...(data.plays ?? [])].reverse();

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

        {/* Three-column layout: Away Box | Play-by-Play | Home Box */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_minmax(360px,480px)_1fr] gap-4 mt-6">
          {/* Away team box score */}
          <div className="order-2 xl:order-1">
            <BoxScoreTable teamBoxScore={awayBoxScore} competitor={awayCompetitor} label="away" />
          </div>

          {/* Play-by-play feed */}
          <div className="order-1 xl:order-2">
            <PlayByPlayFeed
              plays={plays}
              homeAbbrev={homeCompetitor?.team?.abbreviation ?? ''}
              awayAbbrev={awayCompetitor?.team?.abbreviation ?? ''}
              homeColor={homeCompetitor?.team?.color}
              awayColor={awayCompetitor?.team?.color}
            />
          </div>

          {/* Home team box score */}
          <div className="order-3">
            <BoxScoreTable teamBoxScore={homeBoxScore} competitor={homeCompetitor} label="home" />
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
