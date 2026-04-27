'use client';

import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { fetchTeamProfile, fetchTeamRoster, fetchTeamSchedule } from '@/lib/api';
import PlayerLink from './PlayerLink';
import { useModal } from './ModalContext';

interface TeamModalContentProps {
  teamId: string;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center bg-slate-800/60 rounded-xl px-3 py-2.5 flex-1 min-w-[72px]">
      <span className="text-white font-bold text-base leading-tight">{value}</span>
      <span className="text-slate-500 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

function parseRosterAthletes(rosterData: any): Array<{
  id: string;
  name: string;
  shortName: string;
  jersey: string;
  position: string;
  headshot: string;
  ppg: string;
  rpg: string;
  apg: string;
  fgPct: string;
}> {
  const groups: any[] = rosterData?.positionGroups ?? [];
  return groups.flatMap((g: any) =>
    (g.athletes ?? []).map((a: any) => {
      const cats = a?.statistics?.splits?.categories ?? [];
      const map: Record<string, string> = {};
      for (const cat of cats) {
        for (const s of cat.stats ?? []) {
          map[String(s.abbreviation).toUpperCase()] = s.displayValue;
        }
      }
      const rawFg = map['FG%'];
      return {
        id: String(a.id ?? ''),
        name: a.displayName ?? a.fullName ?? '',
        shortName: a.shortName ?? a.displayName ?? '',
        jersey: a.jersey ?? '',
        position: a.position?.abbreviation ?? '',
        headshot: (typeof a.headshot === 'string' ? a.headshot : a.headshot?.href) ?? '',
        ppg: map['PTS'] ?? '-',
        rpg: map['REB'] ?? '-',
        apg: map['AST'] ?? '-',
        fgPct: rawFg ? `${rawFg}%` : '-',
      };
    })
  ).sort((a, b) => parseFloat(b.ppg) - parseFloat(a.ppg));
}

function parseSchedule(
  data: any,
  teamId: string,
): Array<{
  eventId: string;
  dateTs: number;
  date: string;
  opp: string;
  homeAway: string;
  result: string;
  score: string;
  completed: boolean;
}> {
  const events: any[] = data?.events ?? [];

  const rows = events.map((ev: any) => {
    const comp = ev.competitions?.[0];
    const selfTeam = comp?.competitors?.find((c: any) => c.team?.id === teamId);
    const oppTeam  = comp?.competitors?.find((c: any) => c.team?.id !== teamId);
    if (!oppTeam) return null;

    const completed = comp?.status?.type?.completed ?? false;
    const homeAway  = selfTeam?.homeAway === 'home' ? 'vs' : '@';
    const oppAbbr   = oppTeam.team?.abbreviation ?? oppTeam.team?.shortDisplayName ?? '?';
    const selfScore = selfTeam?.score?.displayValue ?? selfTeam?.score ?? '';
    const oppScore  = oppTeam?.score?.displayValue ?? oppTeam?.score ?? '';

    let result = '';
    if (completed && selfScore && oppScore) {
      result = parseInt(selfScore) > parseInt(oppScore) ? 'W'
             : parseInt(selfScore) < parseInt(oppScore) ? 'L'
             : 'T';
    }

    const dateTs = ev.date ? new Date(ev.date).getTime() : 0;
    const dateStr = ev.date
      ? new Date(ev.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '';

    return {
      eventId: String(ev.id ?? comp?.id ?? ''),
      dateTs,
      date: dateStr,
      opp: oppAbbr,
      homeAway,
      result,
      score: selfScore && oppScore ? `${selfScore}-${oppScore}` : '',
      completed,
    };
  }).filter(Boolean) as Array<{
    eventId: string; dateTs: number; date: string; opp: string;
    homeAway: string; result: string; score: string; completed: boolean;
  }>;

  // Deduplicate by eventId, sort chronologically
  const seen = new Set<string>();
  return rows
    .filter(r => { if (seen.has(r.eventId)) return false; seen.add(r.eventId); return true; })
    .sort((a, b) => a.dateTs - b.dateTs);
}

function getTeamStats(profileData: any): Record<string, string> {
  const stats: Record<string, string> = {};
  const team = profileData?.team;
  if (!team) return stats;
  const record = team.record?.items?.[0];
  if (record) {
    const summary = record.summary ?? '';
    stats['RECORD'] = summary;
    const stats2 = record.stats ?? [];
    for (const s of stats2) {
      stats[String(s.name).toUpperCase()] = String(s.value ?? s.displayValue ?? '');
    }
  }
  return stats;
}

export default function TeamModalContent({ teamId }: TeamModalContentProps) {
  const { closeAll } = useModal();
  const router = useRouter();
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const todayCardRef = useRef<HTMLDivElement>(null);

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['teamProfile', teamId],
    queryFn: () => fetchTeamProfile(teamId),
    staleTime: 15 * 60_000,
  });

  const { data: rosterData, isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', teamId],
    queryFn: () => fetchTeamRoster(teamId),
    staleTime: 15 * 60_000,
  });

  const { data: scheduleData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['teamSchedule', teamId],
    queryFn: () => fetchTeamSchedule(teamId),
    staleTime: 5 * 60_000,
  });

  const team = profileData?.team;
  const teamName: string = team?.displayName ?? team?.name ?? '';
  const teamAbbr: string = team?.abbreviation ?? '';
  const teamLogo: string = team?.logos?.[0]?.href ?? team?.logo ?? '';
  const teamColor: string = team?.color ?? '';
  const record: string = team?.record?.items?.[0]?.summary ?? '';
  const venue: string = team?.franchise?.venue?.fullName ?? team?.venue?.fullName ?? '';

  const athletes = parseRosterAthletes(rosterData ?? {});
  const scheduleItems = parseSchedule(scheduleData ?? {}, teamId);

  // Auto-scroll so today's card is centered in the schedule strip
  useEffect(() => {
    if (!scheduleItems.length || !scheduleScrollRef.current || !todayCardRef.current) return;
    const container = scheduleScrollRef.current;
    const card = todayCardRef.current;
    // Center the card horizontally in the container
    container.scrollLeft = card.offsetLeft - container.clientWidth / 2 + card.offsetWidth / 2;
  }, [scheduleItems.length]);


  const teamStats = getTeamStats(profileData ?? {});

  const accentStyle = teamColor ? { background: `#${teamColor}22` } : {};

  if (profileLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="flex gap-4">
          <div className="w-20 h-20 rounded-2xl bg-slate-700/60" />
          <div className="flex-1 space-y-2 pt-2">
            <div className="h-5 bg-slate-700/60 rounded w-3/4" />
            <div className="h-3 bg-slate-700/40 rounded w-1/3" />
          </div>
        </div>
        <div className="h-32 bg-slate-700/30 rounded-xl" />
        <div className="h-48 bg-slate-700/30 rounded-xl" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="px-5 py-5 border-b border-slate-700/50" style={accentStyle}>
        <div className="flex items-center gap-4">
          {teamLogo && (
            <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center">
              <Image src={teamLogo} alt={teamAbbr} width={80} height={80} className="object-contain drop-shadow-lg" />
            </div>
          )}
          <div>
            <h2 className="text-white font-black text-xl leading-tight">{teamName}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {record && (
                <span className="text-slate-300 text-sm font-semibold">{record}</span>
              )}
              {venue && (
                <span className="text-slate-500 text-xs">· {venue}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule strip */}
      {(scheduleLoading || scheduleItems.length > 0) && (
        <div className="px-5 py-4 border-b border-slate-700/50">
          <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-3">
            Schedule
            <span className="ml-2 text-slate-700 normal-case tracking-normal font-normal">scroll to browse season</span>
          </div>
          {scheduleLoading ? (
            <div className="flex gap-2 overflow-hidden pb-1">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[72px] h-[72px] rounded-xl bg-slate-700/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <div ref={scheduleScrollRef} className="flex gap-2 overflow-x-auto scrollbar-subtle pb-1">
              {(() => {
                const now = Date.now();
                // First upcoming game index; if all complete, point to the last game
                const firstUpcomingIdx = scheduleItems.findIndex(ev => !ev.completed && ev.dateTs >= now);
                const anchorIdx = firstUpcomingIdx >= 0 ? firstUpcomingIdx : scheduleItems.length - 1;

                return scheduleItems.map((ev, i) => {
                  const isAnchor = i === anchorIdx;
                  const isNextGame = i === firstUpcomingIdx;
                  const canNavigate = ev.completed && !!ev.eventId;

                  return (
                    <div
                      key={ev.eventId || i}
                      ref={isAnchor ? todayCardRef : undefined}
                      className="flex-shrink-0 flex flex-col items-stretch"
                      style={{ minWidth: 76 }}
                    >
                      {/* "Now" label above the anchor card */}
                      {isNextGame && (
                        <div className="flex items-center gap-1 mb-1 px-0.5">
                          <div className="flex-1 h-px bg-orange-500/40" />
                          <span className="text-orange-400 text-[9px] font-bold uppercase tracking-wider">Now</span>
                          <div className="flex-1 h-px bg-orange-500/40" />
                        </div>
                      )}
                      <button
                        onClick={canNavigate ? () => { closeAll(); router.push(`/game/${ev.eventId}`); } : undefined}
                        disabled={!canNavigate}
                        className={`flex flex-col items-center px-2 py-2 rounded-xl border text-xs w-full transition-all ${
                          isNextGame
                            ? 'ring-1 ring-orange-500/40 bg-orange-950/20 border-orange-500/30 cursor-default'
                            : ev.completed
                            ? ev.result === 'W'
                              ? 'bg-emerald-950/30 border-emerald-500/30 hover:bg-emerald-950/50 hover:border-emerald-400/60 cursor-pointer'
                              : ev.result === 'L'
                              ? 'bg-red-950/30 border-red-500/30 hover:bg-red-950/50 hover:border-red-400/60 cursor-pointer'
                              : 'bg-slate-800/40 border-slate-700/30 hover:border-slate-600/50 cursor-pointer'
                            : 'bg-slate-800/30 border-slate-700/20 cursor-default'
                        }`}
                      >
                        <span className="text-slate-500 text-[10px]">{ev.date}</span>
                        <span className="text-slate-300 font-semibold mt-0.5 text-center leading-tight text-[11px]">
                          {ev.homeAway} {ev.opp}
                        </span>
                        {ev.completed ? (
                          <div className="mt-1 flex flex-col items-center gap-0">
                            <span className={`font-black text-sm leading-none ${ev.result === 'W' ? 'text-emerald-400' : ev.result === 'L' ? 'text-red-400' : 'text-slate-400'}`}>
                              {ev.result}
                            </span>
                            <span className="text-slate-500 text-[10px] font-mono mt-0.5">{ev.score}</span>
                          </div>
                        ) : (
                          <span className="text-slate-600 mt-1 text-[10px]">—</span>
                        )}
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      {/* Roster */}
      <div className="px-5 py-4">
        <div className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-3">Roster</div>
        {rosterLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-700/30 rounded-xl" />)}
          </div>
        ) : athletes.length === 0 ? (
          <p className="text-slate-600 text-sm">Roster unavailable</p>
        ) : (
          <div className="overflow-x-auto scrollbar-subtle -mx-1">
            <table className="w-full text-xs min-w-[340px]">
              <thead>
                <tr className="text-slate-600 uppercase tracking-wider text-[10px] border-b border-slate-700/50">
                  <th className="text-left py-1.5 px-2">Player</th>
                  <th className="text-center py-1.5 px-2 text-white/70">PPG</th>
                  <th className="text-center py-1.5 px-2">RPG</th>
                  <th className="text-center py-1.5 px-2">APG</th>
                  <th className="text-center py-1.5 px-2">FG%</th>
                </tr>
              </thead>
              <tbody>
                {athletes.map((a) => (
                  <tr key={a.id} className="border-b border-slate-700/20 hover:bg-slate-700/20 transition-colors">
                    <td className="py-2 px-2">
                      <PlayerLink athleteId={a.id} className="flex items-center gap-2">
                        {a.headshot ? (
                          <div className="relative w-7 h-7 rounded-full overflow-hidden bg-slate-700/50 flex-shrink-0 border border-slate-700/40">
                            <Image src={a.headshot} alt={a.shortName} fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-700/50 flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-slate-400">
                            {a.shortName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-slate-200 font-medium truncate">{a.shortName}</div>
                          <div className="text-slate-600 text-[10px]">
                            {a.jersey && `#${a.jersey}`}{a.jersey && a.position && ' · '}{a.position}
                          </div>
                        </div>
                      </PlayerLink>
                    </td>
                    <td className="py-2 px-2 text-center text-white font-bold">{a.ppg}</td>
                    <td className="py-2 px-2 text-center text-slate-300">{a.rpg}</td>
                    <td className="py-2 px-2 text-center text-slate-300">{a.apg}</td>
                    <td className="py-2 px-2 text-center text-slate-400">{a.fgPct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
