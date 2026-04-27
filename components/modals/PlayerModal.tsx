'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { fetchPlayerStats, fetchPlayerBio, fetchPlayerGameLog } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useModal } from './ModalContext';
import TeamLink from './TeamLink';

interface PlayerModalContentProps {
  athleteId: string;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-slate-800/60 rounded-xl px-3 py-2.5 min-w-[64px]">
      <span className="text-white font-bold text-base leading-tight">{value}</span>
      <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

function parseOverviewStats(data: any): Record<string, string> {
  const map: Record<string, string> = {};
  const stat = data?.statistics;
  if (!stat) return map;
  const labels: string[] = stat.labels ?? [];
  const splits: any[] = stat.splits ?? [];
  const values: string[] = splits[0]?.stats ?? [];
  labels.forEach((label: string, i: number) => {
    if (values[i] != null && values[i] !== '') map[label.toUpperCase()] = String(values[i]);
  });
  return map;
}

function parseGameLog(data: any): Array<{
  eventId: string;
  date: string;
  opp: string;
  result: string;
  min: string;
  pts: string;
  reb: string;
  ast: string;
  stl: string;
  blk: string;
  to: string;
  fg: string;
  tp: string;
  ft: string;
}> {
  if (!data) return [];

  // events is a dict keyed by eventId with metadata
  const eventMeta: Record<string, any> = data.events ?? {};

  // stats live in seasonTypes[0].categories[0].events (the "event" splitType)
  const labels: string[] = data.labels ?? [];
  const idx = (key: string) => labels.findIndex((l: string) => l.toUpperCase() === key.toUpperCase());

  const minIdx = idx('MIN');
  const ptsIdx = idx('PTS');
  const rebIdx = idx('REB');
  const astIdx = idx('AST');
  const stlIdx = idx('STL');
  const blkIdx = idx('BLK');
  const toIdx  = idx('TO');
  const fgIdx  = idx('FG');
  const tpIdx  = idx('3PT');
  const ftIdx  = idx('FT');

  const get = (stats: string[], i: number) => (i >= 0 && stats[i] != null ? stats[i] : '-');

  // Collect every game event across all season types (regular season + playoffs), skip preseason
  const allRows: Array<{ dateTs: number } & ReturnType<typeof buildRow>> = [];

  function buildRow(ev: any, meta: any) {
    const stats: string[] = ev.stats ?? [];
    const opponent = meta.opponent?.abbreviation ?? meta.opponent?.displayName ?? '?';
    const atVs = meta.atVs === '@' ? '@' : 'vs';
    const dateStr = meta.gameDate
      ? new Date(meta.gameDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';
    const gameResult: string = meta.gameResult ?? '';
    const score: string = meta.score ? ` ${meta.score}` : '';
    return {
      eventId: String(ev.eventId ?? ''),
      date: dateStr,
      opp: `${atVs} ${opponent}`,
      result: `${gameResult}${score}`,
      min: get(stats, minIdx),
      pts: get(stats, ptsIdx),
      reb: get(stats, rebIdx),
      ast: get(stats, astIdx),
      stl: get(stats, stlIdx),
      blk: get(stats, blkIdx),
      to:  get(stats, toIdx),
      fg:  get(stats, fgIdx),
      tp:  get(stats, tpIdx),
      ft:  get(stats, ftIdx),
    };
  }

  for (const seasonType of (data.seasonTypes ?? [])) {
    const name: string = (seasonType.displayName ?? '').toLowerCase();
    if (name.includes('preseason')) continue;

    for (const cat of (seasonType.categories ?? [])) {
      for (const ev of (cat.events ?? [])) {
        const meta = eventMeta[ev.eventId] ?? {};
        const dateTs = meta.gameDate ? new Date(meta.gameDate).getTime() : 0;
        allRows.push({ dateTs, ...buildRow(ev, meta) });
      }
    }
  }

  // Sort newest first, deduplicate by date+opp
  allRows.sort((a, b) => b.dateTs - a.dateTs);
  const seen = new Set<string>();
  return allRows.filter(r => {
    const key = `${r.date}-${r.opp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map(({ dateTs: _dt, ...rest }) => rest);
}

export default function PlayerModalContent({ athleteId }: PlayerModalContentProps) {
  const { openTeam, closeAll } = useModal();
  const router = useRouter();

  const { data: bioData, isLoading: bioLoading } = useQuery({
    queryKey: ['playerBio', athleteId],
    queryFn: () => fetchPlayerBio(athleteId),
    staleTime: 15 * 60_000,
  });

  const { data: overviewData, isLoading: statsLoading } = useQuery({
    queryKey: ['playerStats', athleteId],
    queryFn: () => fetchPlayerStats(athleteId),
    staleTime: 15 * 60_000,
  });

  const { data: gameLogData, isLoading: logLoading } = useQuery({
    queryKey: ['playerGameLog', athleteId],
    queryFn: () => fetchPlayerGameLog(athleteId),
    staleTime: 5 * 60_000,
  });

  const athlete = bioData?.athlete ?? bioData;
  const teamId: string | undefined = athlete?.team?.id ?? athlete?.teams?.[0]?.team?.id;
  const teamAbbr: string = athlete?.team?.abbreviation ?? athlete?.teams?.[0]?.team?.abbreviation ?? '';
  const teamColor: string = athlete?.team?.color ?? athlete?.teams?.[0]?.team?.color ?? '';
  const teamLogo: string = athlete?.team?.logo ?? athlete?.teams?.[0]?.team?.logo ?? '';
  const headshot: string =
    (typeof athlete?.headshot === 'string' ? athlete.headshot : athlete?.headshot?.href) ?? '';
  const fullName: string = athlete?.fullName ?? athlete?.displayName ?? '';
  const position: string = athlete?.position?.displayName ?? athlete?.position?.abbreviation ?? '';
  const jersey: string = athlete?.jersey ?? '';
  const heightStr: string = athlete?.displayHeight ?? athlete?.height ?? '';
  const weightStr: string = athlete?.displayWeight ?? (athlete?.weight ? `${athlete.weight} lbs` : '');
  const age: number | undefined = athlete?.age;

  const stats = parseOverviewStats(overviewData);
  const games = parseGameLog(gameLogData);

  const accentStyle = teamColor ? { background: `#${teamColor}22` } : {};

  if (bioLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-2xl bg-slate-700/60" />
          <div className="flex-1 space-y-2 pt-2">
            <div className="h-5 bg-slate-700/60 rounded w-3/4" />
            <div className="h-3 bg-slate-700/40 rounded w-1/2" />
            <div className="h-3 bg-slate-700/40 rounded w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {[...Array(10)].map((_, i) => <div key={i} className="h-12 bg-slate-700/40 rounded-xl" />)}
        </div>
        <div className="h-48 bg-slate-700/30 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-5 py-5 border-b border-slate-700/50" style={accentStyle}>
        <div className="flex items-start gap-4">
          {/* Headshot */}
          <div className="relative w-24 h-24 rounded-2xl overflow-hidden bg-slate-700/50 flex-shrink-0 border border-slate-700/50">
            {headshot ? (
              <Image src={headshot} alt={fullName} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-2xl font-black">
                {fullName.charAt(0)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-black text-xl leading-tight">{fullName}</h2>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              {jersey && (
                <span className="text-slate-400 text-sm font-semibold">#{jersey}</span>
              )}
              {position && (
                <span className="text-slate-400 text-sm">{position}</span>
              )}
              {teamId ? (
                <TeamLink teamId={teamId} className="flex items-center gap-1.5">
                  {teamLogo && (
                    <Image src={teamLogo} alt={teamAbbr} width={18} height={18} className="object-contain" />
                  )}
                  <span className="text-slate-300 text-sm font-semibold">{teamAbbr}</span>
                </TeamLink>
              ) : teamAbbr ? (
                <span className="text-slate-300 text-sm font-semibold">{teamAbbr}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-2 text-xs text-slate-500">
              {heightStr && <span>{heightStr}</span>}
              {weightStr && <span>{weightStr}</span>}
              {age != null && <span>{age} yrs</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Season averages */}
      <div className="px-5 py-4 border-b border-slate-700/50">
        <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-3">Season Averages</div>
        {statsLoading ? (
          <div className="flex gap-2 overflow-x-auto scrollbar-subtle pb-1">
            {[...Array(10)].map((_, i) => <div key={i} className="h-12 w-16 bg-slate-700/40 rounded-xl flex-shrink-0 animate-pulse" />)}
          </div>
        ) : Object.keys(stats).length === 0 ? (
          <p className="text-slate-600 text-sm">No stats available</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto scrollbar-subtle pb-1">
            {[
              ['GP',   stats['GP']   ?? '-'],
              ['PPG',  stats['PTS']  ?? '-'],
              ['RPG',  stats['REB']  ?? '-'],
              ['APG',  stats['AST']  ?? '-'],
              ['SPG',  stats['STL']  ?? '-'],
              ['BPG',  stats['BLK']  ?? '-'],
              ['TPG',  stats['TO']   ?? '-'],
              ['MPG',  stats['MIN']  ?? '-'],
              ['FG%',  stats['FG%'] ? `${stats['FG%']}%` : '-'],
              ['3P%',  stats['3P%'] ? `${stats['3P%']}%` : stats['3PT%'] ? `${stats['3PT%']}%` : '-'],
              ['FT%',  stats['FT%'] ? `${stats['FT%']}%` : '-'],
            ].map(([label, value]) => (
              <StatCard key={label} label={label} value={value} />
            ))}
          </div>
        )}
      </div>

      {/* Game log */}
      <div className="px-5 py-4">
        <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-3">Game Log</div>
        {logLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-slate-700/30 rounded-lg" />)}
          </div>
        ) : games.length === 0 ? (
          <p className="text-slate-600 text-sm">No game log available</p>
        ) : (
          <div className="overflow-x-auto scrollbar-subtle -mx-1">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-700/50">
                  <th className="text-left py-1.5 px-2 sticky left-0 bg-slate-800/90">Date</th>
                  <th className="text-left py-1.5 px-2">Opp</th>
                  <th className="text-left py-1.5 px-2">Result</th>
                  <th className="text-center py-1.5 px-2">MIN</th>
                  <th className="text-center py-1.5 px-2 text-white/70">PTS</th>
                  <th className="text-center py-1.5 px-2">REB</th>
                  <th className="text-center py-1.5 px-2">AST</th>
                  <th className="text-center py-1.5 px-2">STL</th>
                  <th className="text-center py-1.5 px-2">BLK</th>
                  <th className="text-center py-1.5 px-2">TO</th>
                  <th className="text-center py-1.5 px-2">FG</th>
                  <th className="text-center py-1.5 px-2">3PT</th>
                  <th className="text-center py-1.5 px-2">FT</th>
                </tr>
              </thead>
              <tbody>
                {games.map((g, i) => {
                  const isWin = g.result.startsWith('W');
                  const isLoss = g.result.startsWith('L');
                  const handleRowClick = g.eventId
                    ? () => { closeAll(); router.push(`/game/${g.eventId}`); }
                    : undefined;
                  return (
                    <tr
                      key={i}
                      onClick={handleRowClick}
                      className={`border-b border-slate-700/20 transition-colors ${handleRowClick ? 'cursor-pointer hover:bg-slate-600/30' : 'hover:bg-slate-700/20'}`}
                    >
                      <td className="py-2 px-2 text-slate-500 sticky left-0 bg-slate-900/80 whitespace-nowrap">{g.date}</td>
                      <td className="py-2 px-2 text-slate-400 whitespace-nowrap">{g.opp}</td>
                      <td className={`py-2 px-2 font-semibold whitespace-nowrap ${isWin ? 'text-emerald-400' : isLoss ? 'text-red-400' : 'text-slate-400'}`}>
                        {g.result}
                      </td>
                      <td className="py-2 px-2 text-center text-slate-400">{g.min}</td>
                      <td className="py-2 px-2 text-center text-white font-bold">{g.pts}</td>
                      <td className="py-2 px-2 text-center text-slate-300">{g.reb}</td>
                      <td className="py-2 px-2 text-center text-slate-300">{g.ast}</td>
                      <td className="py-2 px-2 text-center text-slate-400">{g.stl}</td>
                      <td className="py-2 px-2 text-center text-slate-400">{g.blk}</td>
                      <td className="py-2 px-2 text-center text-slate-400">{g.to}</td>
                      <td className="py-2 px-2 text-center text-slate-400">{g.fg}</td>
                      <td className="py-2 px-2 text-center text-slate-400">{g.tp}</td>
                      <td className="py-2 px-2 text-center text-slate-400">{g.ft}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
