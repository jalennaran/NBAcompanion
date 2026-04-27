'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { fetchPlayerStats } from '@/lib/api';
import type { Competitor } from '@/lib/types';
import PlayerLink from './modals/PlayerLink';

interface SeedPlayer {
  athleteId: string;
  name: string;
  headshot: string;
  teamLogo: string;
  teamAbbr: string;
}

function getSeedPlayer(competitor: Competitor): SeedPlayer | null {
  const pointsLeader = competitor.leaders?.find(
    (l) => l.name === 'points' || l.abbreviation === 'PTS'
  );
  const top = pointsLeader?.leaders?.[0];
  if (!top) return null;

  return {
    athleteId: top.athlete.id,
    name: top.athlete.shortName || top.athlete.displayName,
    headshot: top.athlete.headshot,
    teamLogo: competitor.team.logo,
    teamAbbr: competitor.team.abbreviation,
  };
}

/** Parse the ESPN athlete overview response and pull out per-game season averages.
 *  Structure: data.statistics.labels = ['GP','MIN','FG%',...,'REB','AST',...,'PTS']
 *             data.statistics.splits[0].stats = [values matching labels]
 */
function parsePlayerStats(data: any): { ppg: string; rpg: string; apg: string; fgPct: string } {
  const fallback = { ppg: '-', rpg: '-', apg: '-', fgPct: '-' };
  if (!data) return fallback;

  const stat = data?.statistics;
  if (!stat) return fallback;

  const labels: string[] = stat.labels ?? [];
  // Use the Regular Season split (index 0) or first available
  const splits: any[] = stat.splits ?? [];
  const values: string[] = splits[0]?.stats ?? [];

  if (labels.length === 0 || values.length === 0) return fallback;

  function get(keys: string[]): string {
    for (const key of keys) {
      const idx = labels.findIndex((l: string) => l.toUpperCase() === key.toUpperCase());
      if (idx !== -1 && values[idx] != null && values[idx] !== '') return String(values[idx]);
    }
    return '-';
  }

  const rawFg = get(['FG%']);
  const fgPct = rawFg !== '-' ? `${rawFg}%` : '-';

  return {
    ppg: get(['PTS']),
    rpg: get(['REB']),
    apg: get(['AST']),
    fgPct,
  };
}

function PlayerRow({ seed }: { seed: SeedPlayer }) {
  const { data, isLoading } = useQuery({
    queryKey: ['playerStats', seed.athleteId],
    queryFn: () => fetchPlayerStats(seed.athleteId),
    staleTime: 5 * 60_000,
  });

  const stats = parsePlayerStats(data);

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Team logo */}
      <div className="relative w-6 h-6 flex-shrink-0">
        <Image
          src={seed.teamLogo}
          alt={seed.teamAbbr}
          width={24}
          height={24}
          className="object-contain"
        />
      </div>

      {/* Player headshot */}
      <div className="relative w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-slate-700/50">
        {seed.headshot ? (
          <Image
            src={seed.headshot}
            alt={seed.name}
            width={32}
            height={32}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">?</div>
        )}
      </div>

      {/* Name */}
      <PlayerLink athleteId={seed.athleteId} className="text-slate-200 text-sm font-medium truncate min-w-0 flex-shrink">
        {seed.name}
      </PlayerLink>

      {/* Stats */}
      {isLoading ? (
        <div className="ml-auto flex gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-4 w-10 bg-slate-700/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-3 ml-auto flex-shrink-0 text-xs">
          <div className="text-center">
            <span className="text-white font-bold">{stats.ppg}</span>
            <span className="text-slate-500 ml-0.5">PPG</span>
          </div>
          <div className="text-center">
            <span className="text-slate-300 font-semibold">{stats.rpg}</span>
            <span className="text-slate-500 ml-0.5">RPG</span>
          </div>
          <div className="text-center">
            <span className="text-slate-300 font-semibold">{stats.apg}</span>
            <span className="text-slate-500 ml-0.5">APG</span>
          </div>
          <div className="text-center">
            <span className="text-slate-300 font-semibold">{stats.fgPct}</span>
            <span className="text-slate-500 ml-0.5">FG%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreGameLeaders({
  homeTeam,
  awayTeam,
}: {
  homeTeam?: Competitor;
  awayTeam?: Competitor;
}) {
  const seeds: SeedPlayer[] = [];
  if (awayTeam) { const s = getSeedPlayer(awayTeam); if (s) seeds.push(s); }
  if (homeTeam) { const s = getSeedPlayer(homeTeam); if (s) seeds.push(s); }

  if (seeds.length === 0) return null;

  return (
    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-900/15 to-yellow-900/15 backdrop-blur-sm border border-amber-500/20">
      <div className="text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
        Season Leaders
      </div>
      <div className="divide-y divide-slate-700/30">
        {seeds.map((s) => (
          <PlayerRow key={s.athleteId} seed={s} />
        ))}
      </div>
    </div>
  );
}
