'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchGameSummary } from '@/lib/api';
import Image from 'next/image';
import type { TeamBoxScore } from '@/lib/types';
import PlayerLink from './modals/PlayerLink';

interface TopPerformer {
  athleteId: string;
  name: string;
  headshot: string;
  teamLogo: string;
  teamAbbr: string;
  teamColor: string;
  pts: string;
  reb: string;
  ast: string;
  fgPct: string;
}

function getTopPerformer(teamBox: TeamBoxScore): TopPerformer | null {
  const playerStats = teamBox.statistics?.[0];
  if (!playerStats) return null;

  const columns = playerStats.names ?? [];
  const ptsIdx = columns.indexOf('PTS');
  const rebIdx = columns.indexOf('REB');
  const astIdx = columns.indexOf('AST');
  const fgIdx = columns.indexOf('FG');

  if (ptsIdx === -1) return null;

  const athletes = playerStats.athletes?.filter((a) => !a.didNotPlay) ?? [];
  if (athletes.length === 0) return null;

  // Find player with the most points
  let topPlayer = athletes[0];
  let topPts = parseInt(topPlayer.stats[ptsIdx] || '0', 10);

  for (const athlete of athletes) {
    const pts = parseInt(athlete.stats[ptsIdx] || '0', 10);
    if (pts > topPts) {
      topPts = pts;
      topPlayer = athlete;
    }
  }

  // Parse FG (e.g. "8-15") to compute FG%
  let fgPct = '-';
  if (fgIdx !== -1 && topPlayer.stats[fgIdx]) {
    const parts = topPlayer.stats[fgIdx].split('-');
    if (parts.length === 2) {
      const made = parseInt(parts[0], 10);
      const attempted = parseInt(parts[1], 10);
      fgPct = attempted > 0 ? `${Math.round((made / attempted) * 100)}%` : '0%';
    }
  }

  return {
    athleteId: topPlayer.athlete.id,
    name: topPlayer.athlete.shortName || topPlayer.athlete.displayName,
    headshot: (topPlayer.athlete.headshot as any)?.href ?? topPlayer.athlete.headshot ?? '',
    teamLogo: teamBox.team.logo,
    teamAbbr: teamBox.team.abbreviation,
    teamColor: teamBox.team.color,
    pts: topPlayer.stats[ptsIdx] ?? '-',
    reb: rebIdx !== -1 ? (topPlayer.stats[rebIdx] ?? '-') : '-',
    ast: astIdx !== -1 ? (topPlayer.stats[astIdx] ?? '-') : '-',
    fgPct,
  };
}

function PerformerRow({ performer }: { performer: TopPerformer }) {
  return (
    <div className="flex items-center gap-3 py-2">
      {/* Small team logo */}
      <div className="relative w-6 h-6 flex-shrink-0">
        <Image
          src={performer.teamLogo}
          alt={performer.teamAbbr}
          width={24}
          height={24}
          className="object-contain"
        />
      </div>

      {/* Player headshot */}
      <div className="relative w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-slate-700/50">
        {performer.headshot ? (
          <Image
            src={performer.headshot}
            alt={performer.name}
            width={32}
            height={32}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
        )}
      </div>

      {/* Name */}
      <PlayerLink athleteId={performer.athleteId} className="text-slate-200 text-sm font-medium truncate min-w-0 flex-shrink">
        {performer.name}
      </PlayerLink>

      {/* Stats */}
      <div className="flex items-center gap-3 ml-auto flex-shrink-0 text-xs">
        <div className="text-center">
          <span className="text-white font-bold">{performer.pts}</span>
          <span className="text-slate-500 ml-0.5">PTS</span>
        </div>
        <div className="text-center">
          <span className="text-slate-300 font-semibold">{performer.reb}</span>
          <span className="text-slate-500 ml-0.5">REB</span>
        </div>
        <div className="text-center">
          <span className="text-slate-300 font-semibold">{performer.ast}</span>
          <span className="text-slate-500 ml-0.5">AST</span>
        </div>
        <div className="text-center">
          <span className="text-slate-300 font-semibold">{performer.fgPct}</span>
          <span className="text-slate-500 ml-0.5">FG</span>
        </div>
      </div>
    </div>
  );
}

export default function TopPerformers({ gameId }: { gameId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['gameSummary', gameId],
    queryFn: () => fetchGameSummary(gameId),
    staleTime: 30_000, // 30 seconds to avoid excessive refetching on scoreboard
  });

  if (isLoading) {
    return (
      <div className="mt-4 p-3 rounded-2xl bg-slate-800/30 border border-slate-700/20 animate-pulse">
        <div className="h-4 bg-slate-700/30 rounded w-24 mb-3" />
        <div className="h-8 bg-slate-700/20 rounded mb-2" />
        <div className="h-8 bg-slate-700/20 rounded" />
      </div>
    );
  }

  if (!data?.boxscore?.players || data.boxscore.players.length === 0) return null;

  const performers = data.boxscore.players
    .map((teamBox: TeamBoxScore) => getTopPerformer(teamBox))
    .filter(Boolean) as TopPerformer[];

  if (performers.length === 0) return null;

  return (
    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-cyan-900/15 to-blue-900/15 backdrop-blur-sm border border-cyan-500/20">
      <div className="text-cyan-300 text-xs font-bold uppercase tracking-wider mb-2">
        Top Performers
      </div>
      <div className="divide-y divide-slate-700/30">
        {performers.map((p) => (
          <PerformerRow key={p.teamAbbr} performer={p} />
        ))}
      </div>
    </div>
  );
}
