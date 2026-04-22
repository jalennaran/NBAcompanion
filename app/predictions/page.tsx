'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { fetchPredictions, fetchScoreboard } from '@/lib/api';
import Link from 'next/link';
import type { GamePrediction } from '@/lib/types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const ESPN_TO_PRED: Record<string, string> = {
  GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS',
};

function normalizeAbbr(abbr: string): string {
  return ESPN_TO_PRED[abbr] ?? abbr;
}

type BetMarket = 'moneyline' | 'spread' | 'over_under';
type BetResult = 'win' | 'loss' | 'push' | 'pending' | 'live';
type SortFilter = 'all' | 'wins' | 'losses';

interface EvaluatedBet {
  id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_team_full: string;
  away_team_full: string;
  market: BetMarket;
  pick: string;
  result: BetResult;
  actualHome?: number;
  actualAway?: number;
  commence_time: string;
  bet_edge: number;
  bet_flag: boolean;
  odds: number;
  profit: number;
  // needed for live status computation
  betSide: string;
  line: number;
  liveHomeScore?: number;
  liveAwayScore?: number;
  livePeriod?: number;
  liveClockSeconds?: number;
  liveStatusDetail?: string;
  // enriched fields (new format only)
  ev?: number;
  kelly_units?: number;
  modelPct?: number;
  impliedPct?: number;
  mlConfidence?: 'strong' | 'value' | 'longshot' | 'none';
}

interface UpcomingGame {
  bets: EvaluatedBet[];
  simulation?: GamePrediction['simulation'];
  featureImportances?: GamePrediction['feature_importances'];
}

function getBetOdds(pred: GamePrediction, market: BetMarket): number {
  if (market === 'moneyline')
    return pred.moneyline.bet_side === 'home' ? pred.moneyline.ml_home : pred.moneyline.ml_away;
  return -110; // standard juice for spread and O/U
}

function calcProfit(result: BetResult, odds: number): number {
  if (result === 'win') return odds > 0 ? odds : (100 / Math.abs(odds)) * 100;
  if (result === 'loss') return -100;
  return 0;
}

const MARKET_LABEL: Record<BetMarket, string> = {
  moneyline: 'ML',
  spread: 'SPR',
  over_under: 'O/U',
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
  awayScore: number
): BetResult {
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

function parseDisplayClock(displayClock: string): number {
  const parts = (displayClock ?? '').split(':');
  if (parts.length === 2) return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  return 0;
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

function getLiveBetStatus(bet: EvaluatedBet): { label: string; isGood: boolean } | null {
  if (bet.result !== 'live' || bet.liveHomeScore === undefined || bet.liveAwayScore === undefined)
    return null;
  const home = bet.liveHomeScore;
  const away = bet.liveAwayScore;

  if (bet.market === 'moneyline') {
    if (home === away) return { label: 'Tied', isGood: false };
    const winning = bet.betSide === 'home' ? home > away : away > home;
    return { label: winning ? 'Winning' : 'Losing', isGood: winning };
  }

  if (bet.market === 'spread') {
    const adjusted = home - away + bet.line;
    if (bet.betSide === 'home') {
      return adjusted > 0
        ? { label: `Covering by ${adjusted.toFixed(1)}`, isGood: true }
        : { label: `Down ${Math.abs(adjusted).toFixed(1)}`, isGood: false };
    } else {
      return adjusted < 0
        ? { label: `Covering by ${Math.abs(adjusted).toFixed(1)}`, isGood: true }
        : { label: `Down ${adjusted.toFixed(1)}`, isGood: false };
    }
  }

  // O/U projection
  if (bet.livePeriod == null || bet.liveClockSeconds == null) return null;
  const projected = projectTotal(home + away, bet.livePeriod, bet.liveClockSeconds);
  const onPace = bet.betSide === 'over' ? projected > bet.line : projected < bet.line;
  return {
    label: `Pace: ${Math.round(projected)} pts`,
    isGood: onPace,
  };
}

function formatGameTime(isoTime: string): string {
  try {
    return new Date(isoTime).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
    });
  } catch { return ''; }
}

function formatShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[m - 1]} ${d}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function BackLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-8 group"
    >
      <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-sm font-medium">Back to Scores</span>
    </Link>
  );
}

interface RecordData { w: number; l: number; pct: number | null }

function RecordCard({
  label, record, accent, flaggedRecord,
}: {
  label: string;
  record: RecordData;
  accent: string;
  flaggedRecord?: RecordData;
}) {
  return (
    <div className="relative bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-slate-700/50 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accent}`} />
      <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">{label}</div>
      <div className="text-3xl font-black text-white">
        {record.w}<span className="text-slate-500">-</span>{record.l}
      </div>
      <div className={`mt-1 text-lg font-bold bg-gradient-to-r ${accent} bg-clip-text text-transparent`}>
        {record.pct !== null ? `${record.pct}%` : '—'}
      </div>
      {flaggedRecord && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <span className="text-amber-400 text-xs font-bold">⚡ Top Picks</span>
            <span className="text-slate-300 text-xs font-semibold tabular-nums">
              {flaggedRecord.w}-{flaggedRecord.l}
              {flaggedRecord.pct !== null && (
                <span className="text-amber-400 ml-1.5">{flaggedRecord.pct}%</span>
              )}
              {flaggedRecord.pct === null && <span className="text-slate-500 ml-1.5">—</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function MarketBadge({ market }: { market: BetMarket }) {
  const styles: Record<BetMarket, string> = {
    moneyline: 'bg-blue-900/50 text-blue-300 border-blue-700/50',
    spread: 'bg-purple-900/50 text-purple-300 border-purple-700/50',
    over_under: 'bg-teal-900/50 text-teal-300 border-teal-700/50',
  };
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${styles[market]}`}>
      {MARKET_LABEL[market]}
    </span>
  );
}

function PastBetRow({ bet }: { bet: EvaluatedBet }) {
  const isWin = bet.result === 'win';
  const isLoss = bet.result === 'loss';

  const borderColor = isWin
    ? 'border-emerald-500/60'
    : isLoss ? 'border-red-500/60'
    : 'border-slate-600/50';

  const bgGradient = isWin
    ? 'from-emerald-950/40 to-slate-900/50'
    : isLoss ? 'from-red-950/40 to-slate-900/50'
    : 'from-slate-800/30 to-slate-900/50';

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r ${bgGradient} border ${borderColor} backdrop-blur-sm`}>
      <div className="text-slate-500 text-xs font-medium w-12 shrink-0">
        {formatShortDate(bet.game_date)}
      </div>
      <div className="text-slate-300 text-sm font-semibold w-24 shrink-0">
        {bet.away_team} @ {bet.home_team}
      </div>
      <div className="shrink-0">
        <MarketBadge market={bet.market} />
      </div>
      <div className="flex-1 text-slate-200 text-sm font-medium min-w-0 truncate">
        {bet.pick}
        {bet.market === 'moneyline' && bet.mlConfidence === 'strong' && (
          <span className="ml-2 text-amber-300 text-xs">★★</span>
        )}
        {bet.market === 'moneyline' && bet.mlConfidence === 'value' && (
          <span className="ml-2 text-blue-300 text-xs">★</span>
        )}
        {bet.market === 'moneyline' && bet.mlConfidence === 'longshot' && (
          <span className="ml-2 text-slate-500 text-xs">◇</span>
        )}
        {bet.market !== 'moneyline' && bet.bet_flag && (
          <span className="ml-2 text-amber-400 text-xs">⚡</span>
        )}
      </div>
      {bet.actualHome !== undefined && (
        <div className="text-slate-400 text-xs shrink-0 tabular-nums">
          {bet.actualAway}–{bet.actualHome}
        </div>
      )}
      <div className="shrink-0 flex flex-col items-end gap-0.5">
        {bet.result === 'win' && (
          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            HIT
          </span>
        )}
        {bet.result === 'loss' && (
          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">
            MISS
          </span>
        )}
        {bet.result === 'push' && (
          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-600/30 text-slate-400 border border-slate-600/40">
            PUSH
          </span>
        )}
        {bet.result === 'live' && (
          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse">
            LIVE
          </span>
        )}
        {(bet.result === 'win' || bet.result === 'loss') && (
          <span className={`text-xs font-semibold tabular-nums ${bet.result === 'win' ? 'text-emerald-500' : 'text-red-500'}`}>
            {bet.result === 'win' ? '+' : ''}${Math.abs(bet.profit).toFixed(0)}
          </span>
        )}
      </div>
    </div>
  );
}

function LegendSection() {
  const items = [
    {
      icon: (
        <div className="w-16 h-2 bg-slate-800 rounded-full relative shrink-0 mt-0.5">
          <div className="absolute inset-y-0 bg-slate-600/80 rounded-full" style={{ left: '25%', width: '50%' }} />
          <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-amber-400 rounded-full" style={{ left: '55%' }} />
        </div>
      ),
      title: 'Simulation bar',
      desc: 'Gray band = middle 50% of outcomes (p25–p75). Amber line = mean. Edge labels = p10/p90. Built from 10,000 Monte Carlo runs combining the margin and total models.',
    },
    {
      icon: (
        <div className="flex flex-col gap-1 shrink-0">
          {[0.65, 0.4, 0.25].map((w, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden" style={{ width: 64 }}>
                <div className="h-full bg-purple-500/60 rounded-full" style={{ width: `${w * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ),
      title: 'Top Drivers',
      desc: 'The model features that most influenced this specific game\'s margin prediction. Bar length = relative contribution size. Purple = pushes toward home win, orange = pushes toward away win. Values are in points.',
    },
    {
      icon: (
        <span className="text-emerald-400 text-sm font-bold shrink-0 w-16 text-center">+$62 EV</span>
      ),
      title: 'Expected Value (EV)',
      desc: 'Profit per $100 wagered if the model\'s probability is correct long-term. +$62 EV means a $100 bet returns $62 in expected profit. Higher = stronger edge.',
    },
    {
      icon: (
        <span className="text-slate-500 text-xs font-medium shrink-0 w-16 text-center">Kelly 5.8%</span>
      ),
      title: 'Kelly %',
      desc: 'Fractional Kelly criterion: the mathematically optimal bet size as a percentage of your bankroll. Kelly 5.8% means risk 5.8% of your bankroll on this bet.',
    },
    {
      icon: (
        <span className="text-xs shrink-0 w-16 text-center">
          <span className="text-emerald-400/80">29%</span>
          <span className="text-slate-600"> vs </span>
          <span className="text-slate-500">18%</span>
        </span>
      ),
      title: 'Model % vs Implied %',
      desc: 'Green = model\'s estimated win probability. Gray = sportsbook\'s implied probability (derived from the odds). A large gap means the model sees more value than the market does.',
    },
    {
      icon: (
        <div className="flex gap-1 shrink-0 flex-wrap w-16">
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-blue-900/50 text-blue-300 border border-blue-700/50">ML</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-900/50 text-purple-300 border border-purple-700/50">SPR</span>
          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-teal-900/50 text-teal-300 border border-teal-700/50">O/U</span>
        </div>
      ),
      title: 'Market badges',
      desc: 'ML = Moneyline (pick the winner). SPR = Spread (win by more/less than the line). O/U = Over/Under (combined score above or below the total).',
    },
  ];

  return (
    <div className="mt-5 bg-slate-900/40 rounded-2xl border border-slate-700/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700/30 flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">How to read these cards</span>
      </div>
      <div className="grid sm:grid-cols-2 gap-0 divide-y divide-slate-700/20 sm:divide-y-0 sm:divide-x-0">
        {items.map(({ icon, title, desc }) => (
          <div key={title} className="flex gap-3 px-4 py-3 border-b border-slate-700/20 last:border-b-0 sm:[&:nth-child(even)]:border-l sm:[&:nth-child(even)]:border-slate-700/20">
            <div className="flex items-start justify-center w-16 shrink-0 pt-0.5">{icon}</div>
            <div className="min-w-0">
              <div className="text-slate-300 text-xs font-semibold mb-0.5">{title}</div>
              <div className="text-slate-500 text-xs leading-relaxed">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SimBar({
  data, label, homeTeam, awayTeam,
}: {
  data: { mean: number; p10: number; p25: number; p75: number; p90: number };
  label: 'margin' | 'total';
  homeTeam: string;
  awayTeam: string;
}) {
  const range = data.p90 - data.p10;
  const pos = (v: number) => range > 0 ? Math.max(0, Math.min(100, ((v - data.p10) / range) * 100)) : 50;

  const meanLabel = label === 'margin'
    ? data.mean >= 0
      ? `${homeTeam} +${data.mean.toFixed(1)}`
      : `${awayTeam} +${Math.abs(data.mean).toFixed(1)}`
    : `${data.mean.toFixed(1)} pts`;

  const sign = (v: number) => v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-slate-500 text-xs font-semibold uppercase tracking-wide">
          {label === 'margin' ? 'Margin' : 'Total'}
        </span>
        <span className="text-slate-200 text-xs font-bold">{meanLabel}</span>
      </div>
      <div className="relative h-2 bg-slate-800 rounded-full">
        <div
          className="absolute inset-y-0 bg-slate-600/80 rounded-full"
          style={{ left: `${pos(data.p25)}%`, width: `${Math.max(0, pos(data.p75) - pos(data.p25))}%` }}
        />
        <div
          className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-amber-400 rounded-full"
          style={{ left: `${pos(data.mean)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-600 mt-0.5">
        <span>{label === 'margin' ? sign(data.p10) : data.p10.toFixed(0)}</span>
        <span>{label === 'margin' ? sign(data.p90) : data.p90.toFixed(0)}</span>
      </div>
    </div>
  );
}

function FeatureRow({ feature, contribution, maxAbs }: { feature: string; contribution: number; maxAbs: number }) {
  const label = feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const pct = maxAbs > 0 ? Math.abs(contribution) / maxAbs : 0;
  const isPositive = contribution >= 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs w-28 truncate shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${isPositive ? 'bg-purple-500/60' : 'bg-orange-500/60'}`}
          style={{ width: `${(pct * 100).toFixed(0)}%` }}
        />
      </div>
      <span className={`text-xs w-12 text-right shrink-0 tabular-nums ${isPositive ? 'text-purple-400' : 'text-orange-400'}`}>
        {isPositive ? '+' : ''}{contribution.toFixed(1)}
      </span>
    </div>
  );
}

const ML_CONFIDENCE_CONFIG = {
  strong: {
    label: '★★ Strong Edge',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    border: 'border-amber-500/30',
    bg: 'bg-amber-950/20',
  },
  value: {
    label: '★ Value Edge',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    border: 'border-blue-500/25',
    bg: 'bg-blue-950/15',
  },
  longshot: {
    label: '◇ Longshot',
    badge: 'bg-slate-700/50 text-slate-400 border-slate-600/50',
    border: 'border-slate-600/30',
    bg: '',
  },
} as const;

function MLConfidenceBadge({
  confidence,
  ev,
}: {
  confidence: 'strong' | 'value' | 'longshot';
  ev?: number;
}) {
  const cfg = ML_CONFIDENCE_CONFIG[confidence];
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {ev !== undefined && confidence !== 'longshot' && (
        <span className="text-emerald-400 text-xs font-bold">+${ev.toFixed(0)} EV</span>
      )}
      <span className={`px-2 py-0.5 rounded-md text-xs font-bold border ${cfg.badge}`}>
        {cfg.label}
      </span>
    </div>
  );
}

function UpcomingGameCard({ game }: { game: UpcomingGame }) {
  const { bets, simulation, featureImportances } = game;
  const first = bets[0];
  if (!first) return null;
  const isLive = bets.some(b => b.result === 'live');
  const hasEnrichment = !isLive && (simulation != null || featureImportances != null);

  const awayScore = first.liveAwayScore;
  const homeScore = first.liveHomeScore;
  const period = first.livePeriod;
  const statusDetail = first.liveStatusDetail;
  const periodLabel = period ? (period <= 4 ? `Q${period}` : `OT${period - 4}`) : null;
  const topMarginFeatures = featureImportances?.margin_model.slice(0, 3) ?? [];

  return (
    <div className={`bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-2xl p-5 border transition-all ${
      isLive ? 'border-red-500/30' : 'border-slate-700/50'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-white font-bold text-sm leading-tight truncate">{first.away_team_full}</div>
          <div className="text-slate-400 text-xs mt-0.5 truncate">@ {first.home_team_full}</div>
          {!isLive && (
            <div className="text-slate-500 text-xs mt-1">{formatGameTime(first.commence_time)}</div>
          )}
        </div>
        {isLive ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
            LIVE
          </div>
        ) : (
          <div className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
            Upcoming
          </div>
        )}
      </div>

      {/* Live scoreboard */}
      {isLive && awayScore !== undefined && homeScore !== undefined && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2.5 rounded-xl bg-red-950/20 border border-red-500/20">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 text-sm font-semibold">{first.away_team}</span>
              <span className="text-white text-2xl font-black tabular-nums">{awayScore}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-slate-300 text-sm font-semibold">{first.home_team}</span>
              <span className="text-white text-2xl font-black tabular-nums">{homeScore}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            {periodLabel && <div className="text-red-400 text-xs font-bold">{periodLabel}</div>}
            {statusDetail && <div className="text-slate-400 text-xs mt-0.5">{statusDetail}</div>}
          </div>
        </div>
      )}

      {/* Monte Carlo simulation bars */}
      {hasEnrichment && simulation && (
        <div className="mb-3 space-y-3">
          <SimBar
            data={simulation.margin}
            label="margin"
            homeTeam={first.home_team}
            awayTeam={first.away_team}
          />
          <SimBar
            data={simulation.total}
            label="total"
            homeTeam={first.home_team}
            awayTeam={first.away_team}
          />
        </div>
      )}

      {/* Feature importances */}
      {hasEnrichment && topMarginFeatures.length > 0 && (
        <div className="mb-3">
          <div className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-1.5">
            Top Drivers
          </div>
          <div className="space-y-1.5">
            {(() => {
              const maxAbs = Math.max(...topMarginFeatures.map(f => Math.abs(f.contribution ?? 0)), 0.001);
              return topMarginFeatures.map(f => (
                <FeatureRow key={f.feature} feature={f.feature} contribution={f.contribution ?? 0} maxAbs={maxAbs} />
              ));
            })()}
          </div>
        </div>
      )}

      {hasEnrichment && <div className="border-t border-slate-700/40 mb-3" />}

      {/* Bet rows */}
      <div className="space-y-2">
        {bets.map(bet => {
          const liveStatus = getLiveBetStatus(bet);
          return (
            <div
              key={bet.id}
              className={`flex gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
                liveStatus
                  ? liveStatus.isGood
                    ? 'bg-emerald-950/25 border-emerald-500/25'
                    : 'bg-red-950/25 border-red-500/25'
                  : bet.market === 'moneyline' && bet.mlConfidence && bet.mlConfidence !== 'none'
                  ? `${ML_CONFIDENCE_CONFIG[bet.mlConfidence as 'strong' | 'value' | 'longshot'].bg} ${ML_CONFIDENCE_CONFIG[bet.mlConfidence as 'strong' | 'value' | 'longshot'].border}`
                  : 'bg-slate-900/50 border-slate-700/30'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                <MarketBadge market={bet.market} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-200 text-sm font-medium flex-1 min-w-0 truncate">
                    {bet.pick}
                  </span>
                  {liveStatus ? (
                    <span className={`text-xs font-semibold shrink-0 ${liveStatus.isGood ? 'text-emerald-400' : 'text-red-400'}`}>
                      {liveStatus.label}
                    </span>
                  ) : bet.market === 'moneyline' && bet.mlConfidence && bet.mlConfidence !== 'none' ? (
                    <MLConfidenceBadge confidence={bet.mlConfidence} ev={bet.ev} />
                  ) : bet.ev !== undefined ? (
                    <span className="text-emerald-400 text-xs font-bold shrink-0">
                      +${bet.ev.toFixed(0)} EV
                    </span>
                  ) : bet.bet_flag ? (
                    <span className="text-amber-400 text-xs font-bold shrink-0">⚡ Pick</span>
                  ) : (
                    <span className="text-slate-500 text-xs shrink-0 tabular-nums">
                      {(bet.bet_edge * 100).toFixed(1)}% edge
                    </span>
                  )}
                </div>
                {!liveStatus && (
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {bet.modelPct !== undefined && bet.impliedPct !== undefined && (
                      <span className="text-xs">
                        <span className="text-emerald-400/80">{bet.modelPct.toFixed(0)}%</span>
                        <span className="text-slate-600"> vs </span>
                        <span className="text-slate-500">{bet.impliedPct.toFixed(0)}%</span>
                        <span className="text-slate-600"> impl</span>
                      </span>
                    )}
                    {bet.kelly_units !== undefined && (
                      <span className="text-slate-600 text-xs">
                        · Kelly {(bet.kelly_units * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface ProfitSummary { netProfit: number; wagered: number; roi: number }
interface DailyProfitPoint { date: string; cumulative: number; daily: number }

function ProfitChart({ data }: { data: DailyProfitPoint[] }) {
  const isPositive = data.length === 0 || data[data.length - 1].cumulative >= 0;
  const color = isPositive ? '#34d399' : '#f87171';
  const min = Math.min(0, ...data.map(d => d.cumulative));
  const max = Math.max(0, ...data.map(d => d.cumulative));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload as DailyProfitPoint;
    const dailySign = p.daily >= 0 ? '+' : '';
    return (
      <div className="bg-slate-800/95 border border-slate-600/60 rounded-xl px-3 py-2 shadow-xl backdrop-blur-sm">
        <div className="text-slate-400 text-xs mb-1">{label}</div>
        <div className={`text-sm font-black ${p.cumulative >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {p.cumulative >= 0 ? '+' : ''}${p.cumulative.toFixed(0)}
        </div>
        <div className={`text-xs font-medium mt-0.5 ${p.daily >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {dailySign}${p.daily.toFixed(0)} today
        </div>
      </div>
    );
  };

  return (
    <div className="mt-5 pt-5 border-t border-slate-700/50">
      <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Cumulative P&amp;L</div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v >= 0 ? '+' : ''}${v}`}
            domain={[Math.floor(min * 1.1), Math.ceil(max * 1.1)]}
            width={52}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />
          <ReferenceLine y={0} stroke="#475569" strokeWidth={1} strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={color}
            strokeWidth={2}
            fill="url(#profitGradient)"
            dot={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProfitSection({
  all, flagged, byMarket, dailyData,
}: {
  all: ProfitSummary;
  flagged: ProfitSummary;
  byMarket: {
    moneyline: ProfitSummary; moneylineFlagged: ProfitSummary;
    spread: ProfitSummary; spreadFlagged: ProfitSummary;
    over_under: ProfitSummary; overUnderFlagged: ProfitSummary;
  };
  dailyData: DailyProfitPoint[];
}) {
  const fmt = (n: number) =>
    `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(2)}`;
  const fmtRoi = (n: number) =>
    `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

  const isPositive = all.netProfit >= 0;

  const marketRows: { label: string; data: ProfitSummary; flagged: ProfitSummary; color: string }[] = [
    { label: 'Moneyline', data: byMarket.moneyline, flagged: byMarket.moneylineFlagged, color: 'text-blue-400' },
    { label: 'Spread',    data: byMarket.spread,    flagged: byMarket.spreadFlagged,    color: 'text-purple-400' },
    { label: 'Over/Under',data: byMarket.over_under, flagged: byMarket.overUnderFlagged, color: 'text-teal-400' },
  ];

  return (
    <div className="mb-10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50">
      <div className="flex items-center gap-2 mb-5">
        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-lg font-bold text-slate-200">Theoretical Profit</h2>
        <span className="text-slate-500 text-xs">$100 per bet</span>
      </div>

      {/* Main P&L row */}
      <div className="flex flex-wrap items-end gap-6 mb-5">
        <div>
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">All Bets</div>
          <div className={`text-4xl font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(all.netProfit)}
          </div>
          <div className="flex gap-3 mt-1">
            <span className={`text-sm font-semibold ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
              {fmtRoi(all.roi)} ROI
            </span>
            <span className="text-slate-500 text-sm">${all.wagered.toLocaleString()} wagered</span>
          </div>
        </div>

        <div className="h-10 w-px bg-slate-700/60 hidden sm:block" />

        <div>
          <div className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">⚡ Top Picks Only</div>
          <div className={`text-4xl font-black ${flagged.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {fmt(flagged.netProfit)}
          </div>
          <div className="flex gap-3 mt-1">
            <span className={`text-sm font-semibold ${flagged.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {fmtRoi(flagged.roi)} ROI
            </span>
            <span className="text-slate-500 text-sm">${flagged.wagered.toLocaleString()} wagered</span>
          </div>
        </div>
      </div>

      {/* Market breakdown */}
      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-700/50">
        {marketRows.map(({ label, data, flagged, color }) => (
          <div key={label} className="bg-slate-900/40 rounded-2xl p-3 border border-slate-700/30">
            <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>{label}</div>
            <div className={`text-xl font-black ${data.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(data.netProfit)}
            </div>
            <div className={`text-xs font-semibold mt-0.5 ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {fmtRoi(data.roi)} ROI
            </div>
            {flagged.wagered > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-700/40">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-400 text-xs font-bold">⚡</span>
                  <span className={`text-xs font-semibold tabular-nums ${flagged.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {fmt(flagged.netProfit)}
                  </span>
                </div>
                <div className={`text-xs mt-0.5 ${flagged.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {fmtRoi(flagged.roi)} ROI
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {dailyData.length > 1 && <ProfitChart data={dailyData} />}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PredictionsPage() {
  const [filter, setFilter] = useState<SortFilter>('all');
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const { data: predictionsData, isLoading: predsLoading } = useQuery({
    queryKey: ['predictions'],
    queryFn: fetchPredictions,
    staleTime: 5 * 60 * 1000,
  });

  const allRelevantDates = useMemo(() => {
    if (!predictionsData) return [] as string[];
    return [...new Set(predictionsData.map(p => p.game_date))] as string[];
  }, [predictionsData]);

  const scoreboardQueries = useQueries({
    queries: allRelevantDates.map(date => ({
      queryKey: ['scoreboard', date.replace(/-/g, '')],
      queryFn: () => fetchScoreboard(date.replace(/-/g, '')),
      staleTime: date < today ? Infinity : 1_000,
      refetchInterval: date < today
        ? (false as const)
        : (query: any) =>
            query.state.data?.events?.some((e: any) => e.status.type.state === 'in')
              ? 2_500
              : 30_000,
    })),
  });

  const resultsByDate = useMemo(() => {
    type GameResult = {
      homeScore: number; awayScore: number;
      isCompleted: boolean; isLive: boolean;
      period: number; clockSeconds: number; statusDetail: string;
    };
    const map: Record<string, Record<string, GameResult>> = {};
    allRelevantDates.forEach((date, i) => {
      const sb = scoreboardQueries[i]?.data;
      if (!sb) return;
      map[date] = {};
      for (const event of sb.events ?? []) {
        const comp = event.competitions[0];
        const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
        const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
        if (!home || !away) continue;
        const key = `${normalizeAbbr(home.team.abbreviation)}-${normalizeAbbr(away.team.abbreviation)}`;
        map[date][key] = {
          homeScore: parseInt(home.score || '0'),
          awayScore: parseInt(away.score || '0'),
          isCompleted: event.status.type.completed,
          isLive: event.status.type.state === 'in',
          period: event.status.period ?? 0,
          clockSeconds: parseDisplayClock(event.status.displayClock ?? ''),
          statusDetail: event.status.type.shortDetail ?? '',
        };
      }
    });
    return map;
  }, [scoreboardQueries, allRelevantDates]);

  const { pastBets, upcomingGames } = useMemo(() => {
    if (!predictionsData) return { pastBets: [] as EvaluatedBet[], upcomingGames: [] as UpcomingGame[] };

    const past: EvaluatedBet[] = [];
    const upcomingMap = new Map<string, UpcomingGame>();
    const MARKETS: BetMarket[] = ['moneyline', 'spread', 'over_under'];

    for (const entry of predictionsData) {
      const dateResults = resultsByDate[entry.game_date] ?? {};
      for (const game of entry.games) {
        const result = dateResults[`${game.home_team}-${game.away_team}`];
        const gameKey = `${game.game_date}-${game.home_team}-${game.away_team}`;

        for (const market of MARKETS) {
          let betResult: BetResult = 'pending';
          if (result?.isCompleted) {
            betResult = evaluateBet(game, market, result.homeScore, result.awayScore);
          } else if (result?.isLive) {
            betResult = 'live';
          }
          const odds = getBetOdds(game, market);
          const betSide =
            market === 'moneyline' ? game.moneyline.bet_side
            : market === 'spread' ? game.spread.bet_side
            : game.over_under.bet_side;
          const line =
            market === 'spread' ? game.spread.line
            : market === 'over_under' ? game.over_under.line
            : 0;

          let modelPct: number | undefined;
          let impliedPct: number | undefined;
          if (market === 'moneyline') {
            modelPct = game.moneyline.bet_side === 'home'
              ? game.moneyline.predicted_home_win_pct
              : game.moneyline.predicted_away_win_pct;
            impliedPct = game.moneyline.bet_side === 'home'
              ? game.moneyline.implied_home_pct
              : game.moneyline.implied_away_pct;
          } else if (market === 'spread') {
            modelPct = game.spread.bet_side === 'home'
              ? game.spread.home_cover_pct
              : game.spread.away_cover_pct;
            impliedPct = 52.38;
          } else {
            modelPct = game.over_under.bet_side === 'over'
              ? game.over_under.over_pct
              : game.over_under.under_pct;
            impliedPct = 52.38;
          }

          const marketData = game[market];
          const bet: EvaluatedBet = {
            id: `${game.game_date}-${game.home_team}-${game.away_team}-${market}`,
            game_date: game.game_date,
            home_team: game.home_team,
            away_team: game.away_team,
            home_team_full: game.home_team_full,
            away_team_full: game.away_team_full,
            market,
            pick: pickLabel(game, market),
            result: betResult,
            actualHome: result?.homeScore,
            actualAway: result?.awayScore,
            commence_time: game.commence_time,
            bet_edge: marketData.bet_edge,
            bet_flag: marketData.bet_flag,
            odds,
            profit: calcProfit(betResult, odds),
            betSide,
            line,
            liveHomeScore: result?.isLive ? result.homeScore : undefined,
            liveAwayScore: result?.isLive ? result.awayScore : undefined,
            livePeriod: result?.isLive ? result.period : undefined,
            liveClockSeconds: result?.isLive ? result.clockSeconds : undefined,
            liveStatusDetail: result?.isLive ? result.statusDetail : undefined,
            ev: marketData.ev,
            kelly_units: marketData.kelly_units,
            modelPct,
            impliedPct,
            mlConfidence: market === 'moneyline' ? game.moneyline.confidence : undefined,
          };

          if (betResult === 'pending' || betResult === 'live') {
            if (!upcomingMap.has(gameKey)) {
              upcomingMap.set(gameKey, {
                bets: [],
                simulation: game.simulation,
                featureImportances: game.feature_importances,
              });
            }
            upcomingMap.get(gameKey)!.bets.push(bet);
          } else {
            past.push(bet);
          }
        }
      }
    }

    past.sort((a, b) => {
      const dateCmp = b.game_date.localeCompare(a.game_date);
      if (dateCmp !== 0) return dateCmp;
      return MARKETS.indexOf(a.market) - MARKETS.indexOf(b.market);
    });

    return { pastBets: past, upcomingGames: [...upcomingMap.values()] };
  }, [predictionsData, resultsByDate]);

  const records = useMemo(() => {
    const calc = (bets: EvaluatedBet[]) => {
      const w = bets.filter(b => b.result === 'win').length;
      const l = bets.filter(b => b.result === 'loss').length;
      const pct = w + l > 0 ? Math.round((w / (w + l)) * 1000) / 10 : null;
      return { w, l, pct };
    };
    const done = pastBets.filter(b => b.result === 'win' || b.result === 'loss');
    return {
      overall: calc(done),
      overallFlagged: calc(done.filter(b => b.bet_flag)),
      moneyline: calc(done.filter(b => b.market === 'moneyline')),
      moneylineFlagged: calc(done.filter(b => b.market === 'moneyline' && b.bet_flag)),
      spread: calc(done.filter(b => b.market === 'spread')),
      spreadFlagged: calc(done.filter(b => b.market === 'spread' && b.bet_flag)),
      over_under: calc(done.filter(b => b.market === 'over_under')),
      overUnderFlagged: calc(done.filter(b => b.market === 'over_under' && b.bet_flag)),
    };
  }, [pastBets]);

  const theoreticalProfit = useMemo(() => {
    const settled = pastBets.filter(b => b.result === 'win' || b.result === 'loss' || b.result === 'push');
    const flagged = settled.filter(b => b.bet_flag);

    const summarize = (bets: EvaluatedBet[]) => {
      const netProfit = bets.reduce((s, b) => s + b.profit, 0);
      const wagered = bets.filter(b => b.result !== 'push').length * 100;
      const roi = wagered > 0 ? (netProfit / wagered) * 100 : 0;
      return { netProfit, wagered, roi };
    };

    return {
      all: summarize(settled),
      flagged: summarize(flagged),
      byMarket: {
        moneyline:         summarize(settled.filter(b => b.market === 'moneyline')),
        moneylineFlagged:  summarize(settled.filter(b => b.market === 'moneyline' && b.bet_flag)),
        spread:            summarize(settled.filter(b => b.market === 'spread')),
        spreadFlagged:     summarize(settled.filter(b => b.market === 'spread' && b.bet_flag)),
        over_under:        summarize(settled.filter(b => b.market === 'over_under')),
        overUnderFlagged:  summarize(settled.filter(b => b.market === 'over_under' && b.bet_flag)),
      },
    };
  }, [pastBets]);

  const dailyProfitData = useMemo((): DailyProfitPoint[] => {
    const settled = pastBets.filter(b => b.result === 'win' || b.result === 'loss' || b.result === 'push');
    const byDate = new Map<string, number>();
    for (const bet of settled) {
      byDate.set(bet.game_date, (byDate.get(bet.game_date) ?? 0) + bet.profit);
    }
    const dates = [...byDate.keys()].sort();
    let running = 0;
    return dates.map(date => {
      const daily = byDate.get(date)!;
      running += daily;
      const [, m, d] = date.split('-').map(Number);
      const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return { date: `${months[m - 1]} ${d}`, cumulative: Math.round(running * 100) / 100, daily: Math.round(daily * 100) / 100 };
    });
  }, [pastBets]);

  const filteredPastBets = useMemo(() => {
    if (filter === 'wins') return pastBets.filter(b => b.result === 'win');
    if (filter === 'losses') return pastBets.filter(b => b.result === 'loss');
    return pastBets;
  }, [pastBets, filter]);

  if (predsLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-12">
        <div className="max-w-5xl mx-auto">
          <BackLink />
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-slate-400 text-lg">Loading predictions...</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <BackLink />

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-5xl md:text-6xl font-black mb-2 bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent">
            PREDICTIONS
          </h1>
          <p className="text-slate-500 text-sm">
            Model bet tracking &nbsp;·&nbsp;
            <span className="text-amber-300"> ★★</span> Strong &nbsp;
            <span className="text-blue-300">★</span> Value &nbsp;
            <span className="text-slate-500">◇</span> Longshot
          </p>
        </div>

        {/* Records */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <RecordCard label="Overall" record={records.overall} accent="from-orange-500 to-red-500" flaggedRecord={records.overallFlagged} />
          <RecordCard label="Moneyline" record={records.moneyline} accent="from-blue-500 to-cyan-500" flaggedRecord={records.moneylineFlagged} />
          <RecordCard label="Spread" record={records.spread} accent="from-purple-500 to-violet-500" flaggedRecord={records.spreadFlagged} />
          <RecordCard label="Over / Under" record={records.over_under} accent="from-emerald-500 to-teal-500" flaggedRecord={records.overUnderFlagged} />
        </div>

        {/* Upcoming / In Progress */}
        {/* Theoretical Profit */}
        {theoreticalProfit.all.wagered > 0 && (
          <ProfitSection
            all={theoreticalProfit.all}
            flagged={theoreticalProfit.flagged}
            byMarket={theoreticalProfit.byMarket}
            dailyData={dailyProfitData}
          />
        )}

        {upcomingGames.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
              Upcoming &amp; In Progress
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {upcomingGames.map(game => (
                <UpcomingGameCard
                  key={`${game.bets[0].game_date}-${game.bets[0].home_team}-${game.bets[0].away_team}`}
                  game={game}
                />
              ))}
            </div>
            <LegendSection />
          </section>
        )}

        {/* Past Bets */}
        <section>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="text-lg font-bold text-slate-200">Past Bets</h2>
            <div className="flex gap-2">
              {(['all', 'wins', 'losses'] as SortFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all capitalize border ${
                    filter === f
                      ? f === 'wins'
                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
                        : f === 'losses'
                        ? 'bg-red-600/30 text-red-300 border-red-500/50'
                        : 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                      : 'bg-slate-800/60 text-slate-400 border-slate-700/50 hover:border-slate-500/50 hover:text-slate-200'
                  }`}
                >
                  {f === 'all'
                    ? `All (${pastBets.length})`
                    : f === 'wins'
                    ? `Wins (${records.overall.w})`
                    : `Losses (${records.overall.l})`}
                </button>
              ))}
            </div>
          </div>

          {filteredPastBets.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-slate-500 text-lg">No completed bets yet</div>
              <div className="text-slate-600 text-sm mt-1">Check back after games finish</div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPastBets.map(bet => (
                <PastBetRow key={bet.id} bet={bet} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
