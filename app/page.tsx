'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchScoreboard, fetchPredictions } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import TopPerformers from '@/components/TopPerformers';
import PreGameLeaders from '@/components/PreGameLeaders';
import type { GamePrediction } from '@/lib/types';

const ESPN_TO_PRED: Record<string, string> = {
  GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS',
};

function normalizeAbbr(abbr: string): string {
  return ESPN_TO_PRED[abbr] ?? abbr;
}

function projectTotal(currentTotal: number, period: number, clockSeconds: number): number {
  const minutesElapsed =
    period <= 4
      ? (period - 1) * 12 + (12 - clockSeconds / 60)
      : 48 + (period - 5) * 5 + (5 - clockSeconds / 60);
  if (minutesElapsed <= 0) return 0;
  const totalMinutes = period <= 4 ? 48 : 48 + (period - 4) * 5;
  return (currentTotal / minutesElapsed) * totalMinutes;
}

function parseDisplayClock(displayClock: string): number {
  const parts = (displayClock ?? '').split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
}

type BetMarket = 'moneyline' | 'spread' | 'over_under';

const MARKET_LABEL: Record<BetMarket, string> = {
  moneyline: 'ML',
  spread: 'SPR',
  over_under: 'O/U',
};

const MARKET_STYLES: Record<BetMarket, string> = {
  moneyline: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
  spread: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
  over_under: 'bg-teal-900/50 text-teal-300 border-teal-700/50',
};

function pickLabel(pred: GamePrediction, market: BetMarket): string {
  if (market === 'moneyline') {
    const side = pred.moneyline.bet_side;
    const team = side === 'home' ? pred.home_team : pred.away_team;
    const odds = side === 'home' ? pred.moneyline.ml_home : pred.moneyline.ml_away;
    return `${team} (${odds > 0 ? '+' : ''}${odds})`;
  }
  if (market === 'spread') {
    if (pred.spread.bet_side === 'home') {
      return `${pred.home_team} ${pred.spread.line > 0 ? '+' : ''}${pred.spread.line}`;
    }
    const awayLine = -pred.spread.line;
    return `${pred.away_team} ${awayLine > 0 ? '+' : ''}${awayLine}`;
  }
  return `${pred.over_under.bet_side === 'over' ? 'Over' : 'Under'} ${pred.over_under.line}`;
}

function evaluateBet(
  pred: GamePrediction,
  market: BetMarket,
  homeScore: number,
  awayScore: number,
): 'win' | 'loss' | 'push' {
  if (market === 'moneyline') {
    if (pred.moneyline.bet_side === 'home')
      return homeScore > awayScore ? 'win' : homeScore < awayScore ? 'loss' : 'push';
    return awayScore > homeScore ? 'win' : awayScore < homeScore ? 'loss' : 'push';
  }
  if (market === 'spread') {
    const adjusted = homeScore - awayScore + pred.spread.line;
    if (pred.spread.bet_side === 'home') return adjusted > 0 ? 'win' : adjusted < 0 ? 'loss' : 'push';
    return adjusted < 0 ? 'win' : adjusted > 0 ? 'loss' : 'push';
  }
  const total = homeScore + awayScore;
  if (pred.over_under.bet_side === 'over')
    return total > pred.over_under.line ? 'win' : total < pred.over_under.line ? 'loss' : 'push';
  return total < pred.over_under.line ? 'win' : total > pred.over_under.line ? 'loss' : 'push';
}

function getLiveStatus(
  pred: GamePrediction,
  market: BetMarket,
  homeScore: number,
  awayScore: number,
  period: number,
  clockSeconds: number,
): { label: string; isGood: boolean } | null {
  if (market === 'moneyline') {
    if (homeScore === awayScore) return { label: 'Tied', isGood: false };
    const betHome = pred.moneyline.bet_side === 'home';
    const winning = betHome ? homeScore > awayScore : awayScore > homeScore;
    return { label: winning ? 'Winning' : 'Losing', isGood: winning };
  }
  if (market === 'spread') {
    const adjusted = homeScore - awayScore + pred.spread.line;
    if (pred.spread.bet_side === 'home') {
      return adjusted > 0
        ? { label: `Covering by ${adjusted.toFixed(1)}`, isGood: true }
        : { label: `Down ${Math.abs(adjusted).toFixed(1)}`, isGood: false };
    } else {
      return adjusted < 0
        ? { label: `Covering by ${Math.abs(adjusted).toFixed(1)}`, isGood: true }
        : { label: `Down ${adjusted.toFixed(1)}`, isGood: false };
    }
  }
  if (period == null || clockSeconds == null) return null;
  const projected = projectTotal(homeScore + awayScore, period, clockSeconds);
  const onPace = pred.over_under.bet_side === 'over' ? projected > pred.over_under.line : projected < pred.over_under.line;
  return { label: `Pace: ${Math.round(projected)} pts`, isGood: onPace };
}

function PredictionsNavLink() {
  return (
    <Link
      href="/predictions"
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500/10 to-purple-600/10 border border-orange-500/25 hover:border-orange-400/50 hover:from-orange-500/20 hover:to-purple-600/20 transition-all text-orange-300 hover:text-orange-200 font-semibold text-sm shrink-0"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      Predictions
    </Link>
  );
}

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const isToday = isSameDay(selectedDate, new Date());
  const dateParam = isToday ? undefined : formatDateParam(selectedDate);

  const { data, isLoading, error } = useQuery({
    queryKey: ['scoreboard', dateParam ?? 'today'],
    queryFn: () => fetchScoreboard(dateParam),
    refetchInterval: (query) =>
      query.state.data?.events?.some((e: any) => e.status.type.state === 'in')
        ? 2_500
        : 30_000,
    staleTime: 1_000,
  });

  const { data: predictionsData } = useQuery({
    queryKey: ['predictions'],
    queryFn: fetchPredictions,
    staleTime: 5 * 60 * 1000,
  });

  const shiftDate = (days: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + days);
      return next;
    });
  };


  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-black mb-12 bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent">
            NBA LIVE
          </h1>
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-slate-400 text-lg">Loading games...</div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-12">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-black mb-12 bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent">
            NBA LIVE
          </h1>
          <p className="text-red-400 bg-red-950/30 backdrop-blur-sm p-6 rounded-2xl border border-red-900/50">
            Error loading games: {error.message}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-5xl md:text-6xl font-black mb-3 bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent">
              NBA {isToday ? 'LIVE' : 'SCORES'}
            </h1>
            <div className="mt-2">
              <PredictionsNavLink />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <button
              onClick={() => shiftDate(-1)}
              className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-500/50 hover:bg-slate-700/60 transition-all text-slate-300 hover:text-white"
              aria-label="Previous day"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-slate-300 text-lg font-medium select-none">
              {selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <button
              onClick={() => shiftDate(1)}
              className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:border-slate-500/50 hover:bg-slate-700/60 transition-all text-slate-300 hover:text-white"
              aria-label="Next day"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            {!isToday && (
              <button
                onClick={() => setSelectedDate(new Date())}
                className="ml-2 px-3 py-1.5 rounded-xl bg-purple-600/30 border border-purple-500/40 hover:bg-purple-600/50 transition-all text-purple-300 text-sm font-semibold"
              >
                Today
              </button>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data?.events?.length === 0 ? (
            <div className="col-span-full text-center py-20">
              <p className="text-slate-400 text-xl">No games scheduled today</p>
            </div>
          ) : (
            data?.events?.map((game) => {
              const competition = game.competitions[0];
              const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
              const awayTeam = competition.competitors.find(c => c.homeAway === 'away');
              const isLive = game.status.type.state === 'in';
              const isFinal = game.status.type.completed;
              const lastPlay = competition.situation?.lastPlay;
              const odds = competition.odds?.[0];
              const hasNotStarted = !isLive && !isFinal;
              const primaryBroadcast =
                competition.broadcasts?.find((broadcast) => broadcast.market === 'national') ||
                competition.broadcasts?.find((broadcast) => broadcast.market === 'home');
              const broadcastNames = primaryBroadcast?.names
                ?.filter((name) => name && name !== 'NBA League Pass')
                .join(', ');
              
              // Match prediction for this game
              const allPredictions = predictionsData?.flatMap(f => f.games) ?? [];
              const prediction = allPredictions.find(p =>
                normalizeAbbr(homeTeam?.team.abbreviation ?? '') === p.home_team &&
                normalizeAbbr(awayTeam?.team.abbreviation ?? '') === p.away_team
              ) ?? null;

              // Calculate spread coverage for finished games
              let spreadCoverage = null;
              if (isFinal && odds && homeTeam && awayTeam) {
                const homeScore = parseInt(homeTeam.score || '0');
                const awayScore = parseInt(awayTeam.score || '0');
                const scoreDiff = homeScore - awayScore; // Positive if home wins
                const spread = odds.spread; // Negative if home is favored
                
                if (scoreDiff + spread > 0) {
                  spreadCoverage = { team: homeTeam.team.abbreviation, covered: true };
                } else if (scoreDiff + spread < 0) {
                  spreadCoverage = { team: awayTeam.team.abbreviation, covered: true };
                } else {
                  spreadCoverage = { team: 'push', covered: false };
                }
              }
              
              return (
                <Link
                  href={`/game/${game.id}`}
                  key={game.id}
                  className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-900/20 block cursor-pointer"
                >
                  {/* Live indicator */}
                  {isLive && (
                    <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/50">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-red-400 text-xs font-bold uppercase tracking-wider">Live</span>
                    </div>
                  )}

                  {/* Game status */}
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="text-slate-400 text-sm font-medium">
                        {game.status.type.shortDetail}
                        {broadcastNames ? ` - ${broadcastNames}` : ''}
                      </div>
                      {competition.venue && (
                        <div className="text-slate-500 text-xs flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {competition.venue.fullName}
                        </div>
                      )}
                    </div>
                    {isFinal && (
                      <div className="text-emerald-400 text-sm font-bold uppercase tracking-wider bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/30">
                        Final
                      </div>
                    )}
                  </div>

                  {/* Teams */}
                  <div className="space-y-4">
                    {/* Away Team */}
                    {awayTeam && (
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 hover:border-slate-600/50 transition-all">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="relative w-14 h-14 flex-shrink-0">
                            <div 
                              className="absolute inset-0 rounded-xl opacity-20 blur-lg"
                              style={{ backgroundColor: `#${awayTeam.team.color}` }}
                            />
                            <div className="relative w-full h-full flex items-center justify-center bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
                              <Image
                                src={awayTeam.team.logo}
                                alt={awayTeam.team.abbreviation}
                                width={40}
                                height={40}
                                className="object-contain"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="text-white font-bold text-lg">
                              {awayTeam.team.abbreviation}
                            </div>
                            <div className="text-slate-400 text-sm">
                              {awayTeam.team.location}
                            </div>
                            {awayTeam.records?.[0] && (
                              <div className="text-slate-500 text-xs mt-0.5">
                                {awayTeam.records[0].summary}
                              </div>
                            )}
                          </div>
                        </div>
                        <div 
                          className="text-4xl font-black bg-gradient-to-br from-white to-slate-300 bg-clip-text text-transparent"
                        >
                          {awayTeam.score || '0'}
                        </div>
                      </div>
                    )}

                    {/* Home Team */}
                    {homeTeam && (
                      <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/40 backdrop-blur-sm border border-slate-700/30 hover:border-slate-600/50 transition-all">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="relative w-14 h-14 flex-shrink-0">
                            <div 
                              className="absolute inset-0 rounded-xl opacity-20 blur-lg"
                              style={{ backgroundColor: `#${homeTeam.team.color}` }}
                            />
                            <div className="relative w-full h-full flex items-center justify-center bg-white/5 rounded-xl backdrop-blur-sm border border-white/10">
                              <Image
                                src={homeTeam.team.logo}
                                alt={homeTeam.team.abbreviation}
                                width={40}
                                height={40}
                                className="object-contain"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="text-white font-bold text-lg">
                              {homeTeam.team.abbreviation} 🏠
                            </div>
                            <div className="text-slate-400 text-sm">
                              {homeTeam.team.location}
                            </div>
                            {homeTeam.records?.[0] && (
                              <div className="text-slate-500 text-xs mt-0.5">
                                {homeTeam.records[0].summary}
                              </div>
                            )}
                          </div>
                        </div>
                        <div 
                          className="text-4xl font-black bg-gradient-to-br from-white to-slate-300 bg-clip-text text-transparent"
                        >
                          {homeTeam.score || '0'}
                        </div>
                      </div>
                    )}
                    
                  </div>

                  {/* Model Picks - show for any game with a prediction */}
                  {prediction && (
                    <div className="mt-4 space-y-1.5">
                      {(['moneyline', 'spread', 'over_under'] as const).map((market) => {
                        const label = pickLabel(prediction, market);
                        const homeScore = parseInt(homeTeam?.score ?? '0');
                        const awayScore = parseInt(awayTeam?.score ?? '0');
                        const liveStatus = isLive
                          ? getLiveStatus(prediction, market, homeScore, awayScore, game.status.period, game.status.clock)
                          : null;
                        const finalResult = isFinal
                          ? evaluateBet(prediction, market, homeScore, awayScore)
                          : null;
                        return (
                          <div
                            key={market}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${
                              liveStatus
                                ? liveStatus.isGood
                                  ? 'bg-emerald-950/25 border-emerald-500/25'
                                  : 'bg-red-950/25 border-red-500/25'
                                : finalResult === 'win'
                                ? 'bg-emerald-950/25 border-emerald-500/25'
                                : finalResult === 'loss'
                                ? 'bg-red-950/25 border-red-500/25'
                                : 'bg-slate-900/30 border-slate-700/20'
                            }`}
                          >
                            <span className={`px-2 py-0.5 rounded-md text-xs font-bold border shrink-0 ${MARKET_STYLES[market]}`}>
                              {MARKET_LABEL[market]}
                            </span>
                            <span className="text-slate-200 text-sm font-medium flex-1 min-w-0 truncate">
                              {label}
                            </span>
                            {liveStatus && (
                              <span className={`text-xs font-semibold shrink-0 ${liveStatus.isGood ? 'text-emerald-400' : 'text-red-400'}`}>
                                {liveStatus.label}
                              </span>
                            )}
                            {finalResult && (
                              <span className={`text-xs font-bold shrink-0 px-1.5 py-0.5 rounded ${
                                finalResult === 'win'
                                  ? 'text-emerald-400 bg-emerald-500/15'
                                  : finalResult === 'loss'
                                  ? 'text-red-400 bg-red-500/15'
                                  : 'text-slate-400 bg-slate-600/20'
                              }`}>
                                {finalResult === 'win' ? 'HIT' : finalResult === 'loss' ? 'MISS' : 'PUSH'}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Top Performers - Only show for live or completed games */}
                  {(isLive || isFinal) && (
                    <TopPerformers gameId={game.id} />
                  )}

                  {/* Season Leaders - Only show for games that haven't started */}
                  {hasNotStarted && (
                    <PreGameLeaders homeTeam={homeTeam} awayTeam={awayTeam} />
                  )}

                  {/* Betting Lines - Only show for games that haven't started */}
                  {hasNotStarted && odds && (
                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-green-900/20 to-emerald-900/20 backdrop-blur-sm border border-green-500/30">
                      <div className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
                        Betting Lines ({odds.provider.name})
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-slate-400 text-xs mb-1">Spread</div>
                          <div className="text-slate-100 font-semibold">{odds.details}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs mb-1">Over/Under</div>
                          <div className="text-slate-100 font-semibold">{odds.overUnder}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs mb-1">Moneyline</div>
                          <div className="text-slate-100 font-semibold">
                            {homeTeam?.team.abbreviation} {odds.moneyline?.home?.close?.odds}
                          </div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs mb-1">&nbsp;</div>
                          <div className="text-slate-100 font-semibold">
                            {awayTeam?.team.abbreviation} {odds.moneyline?.away?.close?.odds}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Spread Coverage - Only show for finished games */}
                  {isFinal && spreadCoverage && (
                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-900/20 to-orange-900/20 backdrop-blur-sm border border-amber-500/30">
                      <div className="text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
                        Spread Result
                      </div>
                      {spreadCoverage.team === 'push' ? (
                        <div className="text-slate-200 text-sm">
                          <span className="font-semibold">Push</span> - Landed exactly on the spread
                        </div>
                      ) : (
                        <div className="text-slate-200 text-sm">
                          <span className="font-semibold text-amber-400">{spreadCoverage.team}</span> covered the spread
                          {odds && <span className="text-slate-400 ml-2">({odds.details})</span>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Last Play - Only show if there's a play */}
                  {lastPlay?.text && (
                    <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-purple-900/20 to-blue-900/20 backdrop-blur-sm border border-purple-500/30">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-purple-300 text-xs font-bold uppercase tracking-wider mb-1">
                            Last Play
                          </div>
                          <p className="text-slate-200 text-sm leading-relaxed">
                            {lastPlay.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
