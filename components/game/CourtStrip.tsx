'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import Image from 'next/image';
import { ShotHeatmapLayer, type HeatmapTeamFilter } from './ShotHeatmapLayer';
import type { Play } from '@/lib/types';

export type OnCourtPlayer = {
  name: string;
  jersey?: string;
  position?: string;
  headshotUrl?: string;
};

type CourtStripProps = {
  homeTeamName: string;
  homeTeamLogoUrl: string;
  awayTeamName?: string;
  awayTeamColor?: string;
  homeTeamColor?: string;
  awayOnCourt?: OnCourtPlayer[];
  homeOnCourt?: OnCourtPlayer[];
  panelLabel?: string;
  className?: string;
  height?: number;
  showDemo?: boolean;
  plays?: Play[];
  homeTeamId?: string;
};

export default function CourtStrip({
  homeTeamName,
  homeTeamLogoUrl,
  awayTeamName,
  awayTeamColor,
  homeTeamColor,
  awayOnCourt = [],
  homeOnCourt = [],
  panelLabel,
  className,
  height = 440,
  showDemo = false,
  plays,
  homeTeamId = '',
}: CourtStripProps) {
  const [logoFailed, setLogoFailed] = useState(!homeTeamLogoUrl);
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapTeamFilter | null>('both');
  const svgId = useId().replace(/:/g, '');

  useEffect(() => {
    setLogoFailed(!homeTeamLogoUrl);
  }, [homeTeamLogoUrl]);

  const badgeLetter = useMemo(() => {
    const first = homeTeamName?.trim()?.charAt(0);
    return first ? first.toUpperCase() : '?';
  }, [homeTeamName]);

  const woodGradientId = `wood-${svgId}`;
  const woodStripesId = `wood-stripes-${svgId}`;

  const hasLineups = awayOnCourt.length > 0 || homeOnCourt.length > 0;

  return (
    <div className={`w-full ${className ?? ''}`}>
      <div className={`flex items-stretch gap-3 ${hasLineups ? '' : 'justify-center'}`}>
        {/* Away team on-court panel (left) */}
        {hasLineups && (
          <OnCourtPanel
            teamName={awayTeamName ?? 'Away'}
            teamColor={awayTeamColor}
            players={awayOnCourt}
            side="left"
            panelLabel={panelLabel}
          />
        )}

        {/* Court */}
        <div
          className="relative flex-1 min-w-0 overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/70 shadow-[0_12px_34px_-22px_rgba(0,0,0,0.9)]"
          style={{
            maxHeight: height ? `${height}px` : undefined,
            aspectRatio: '94 / 50',
          }}
        >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 94 50"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Top-down NBA basketball court"
        >
          <defs>
            <linearGradient id={woodGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ddc7a8" />
              <stop offset="100%" stopColor="#ccb08d" />
            </linearGradient>
            <pattern id={woodStripesId} width="4" height="50" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="2" height="50" fill="rgba(112,80,54,0.08)" />
              <rect x="2" y="0" width="2" height="50" fill="rgba(112,80,54,0.03)" />
            </pattern>
          </defs>

          <rect x="0" y="0" width="94" height="50" fill={`url(#${woodGradientId})`} />
          <rect x="0" y="0" width="94" height="50" fill={`url(#${woodStripesId})`} />

          <rect
            x="0.8"
            y="0.8"
            width="92.4"
            height="48.4"
            fill="none"
            stroke="rgba(105,74,50,0.7)"
            strokeWidth="0.34"
          />
          <line x1="47" y1="0.8" x2="47" y2="49.2" stroke="rgba(105,74,50,0.62)" strokeWidth="0.3" />
          <circle
            cx="47"
            cy="25"
            r="6"
            fill="none"
            stroke="rgba(105,74,50,0.62)"
            strokeWidth="0.3"
          />
          <circle
            cx="47"
            cy="25"
            r="2"
            fill="none"
            stroke="rgba(105,74,50,0.62)"
            strokeWidth="0.25"
          />

          <rect x="0.8" y="17" width="19" height="16" fill="rgba(136,100,70,0.20)" />
          <rect x="74.2" y="17" width="19" height="16" fill="rgba(136,100,70,0.20)" />

          <circle
            cx="19.8"
            cy="25"
            r="6"
            fill="none"
            stroke="rgba(105,74,50,0.45)"
            strokeWidth="0.28"
          />
          <circle
            cx="74.2"
            cy="25"
            r="6"
            fill="none"
            stroke="rgba(105,74,50,0.45)"
            strokeWidth="0.28"
          />

          <path
            d="M 0.8 3 L 14 3 A 23.75 23.75 0 0 1 14 47 L 0.8 47"
            fill="none"
            stroke="rgba(105,74,50,0.58)"
            strokeWidth="0.3"
          />
          <path
            d="M 93.2 3 L 80 3 A 23.75 23.75 0 0 0 80 47 L 93.2 47"
            fill="none"
            stroke="rgba(105,74,50,0.58)"
            strokeWidth="0.3"
          />

          <line x1="4" y1="22" x2="4" y2="28" stroke="rgba(115,83,57,0.65)" strokeWidth="0.33" />
          <line x1="90" y1="22" x2="90" y2="28" stroke="rgba(115,83,57,0.65)" strokeWidth="0.33" />

          <path
            d="M 5.25 21 A 4 4 0 0 1 5.25 29"
            fill="none"
            stroke="rgba(115,83,57,0.55)"
            strokeWidth="0.28"
          />
          <path
            d="M 88.75 21 A 4 4 0 0 0 88.75 29"
            fill="none"
            stroke="rgba(115,83,57,0.55)"
            strokeWidth="0.28"
          />

          <circle cx="5.25" cy="25" r="0.75" fill="none" stroke="#f97316" strokeWidth="0.35" />
          <circle cx="88.75" cy="25" r="0.75" fill="none" stroke="#f97316" strokeWidth="0.35" />

          {/* Red padding blocks (ESPN stanchion pads) */}
          <rect x="2.2" y="20.8" width="1.4" height="8.4" rx="0.35" fill="#dc2626" opacity="0.7" />
          <rect x="90.4" y="20.8" width="1.4" height="8.4" rx="0.35" fill="#dc2626" opacity="0.7" />

          {/* Shot heat map — shown when a filter is active */}
          {heatmapFilter && plays && plays.length > 0 && (
            <ShotHeatmapLayer
              plays={plays}
              homeTeamId={homeTeamId}
              teamFilter={heatmapFilter}
            />
          )}

          {showDemo && (
            <g aria-label="Demo shot markers">
              <line x1="34" y1="15" x2="37" y2="18" stroke="#9ca3af" strokeWidth="0.22" />
              <circle cx="34" cy="15" r="0.8" fill="#f97316" stroke="#fff7ed" strokeWidth="0.16" />
              <circle cx="37" cy="18" r="0.35" fill="#64748b" />

              <line x1="64" y1="34" x2="61.5" y2="31.6" stroke="#9ca3af" strokeWidth="0.22" />
              <circle cx="64" cy="34" r="0.8" fill="#f97316" stroke="#fff7ed" strokeWidth="0.16" />
              <circle cx="61.5" cy="31.6" r="0.35" fill="#64748b" />
            </g>
          )}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          {logoFailed ? (
            <div
              className="flex items-center justify-center rounded-full border border-slate-200/75 bg-slate-950/30 font-black text-slate-100 w-[12%] aspect-square text-[clamp(18px,3vw,36px)]"
            >
              {badgeLetter}
            </div>
          ) : (
            <img
              src={homeTeamLogoUrl}
              alt={`${homeTeamName} logo`}
              className="object-contain drop-shadow-[0_6px_14px_rgba(15,23,42,0.35)] w-[12%] max-w-[100px]"
              onError={() => setLogoFailed(true)}
            />
          )}
        </div>

        {/* Heat map toggle — only shown when plays data is available */}
        {plays && plays.length > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 border border-white/10">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold mr-0.5">Heat</span>
            {([
              { filter: 'away', label: awayTeamName ?? 'Away' },
              { filter: 'both', label: 'All' },
              { filter: 'home', label: homeTeamName },
            ] as const).map(({ filter, label }) => (
              <button
                key={filter}
                onClick={() => setHeatmapFilter(heatmapFilter === filter ? null : filter)}
                className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded transition-colors ${
                  heatmapFilter === filter
                    ? 'bg-orange-500/80 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        </div>

        {/* Home team on-court panel (right) */}
        {hasLineups && (
          <OnCourtPanel
            teamName={homeTeamName ?? 'Home'}
            teamColor={homeTeamColor}
            players={homeOnCourt}
            side="right"
            panelLabel={panelLabel}
          />
        )}
      </div>
    </div>
  );
}

/* ─── On-Court Player Panel ──────────────────────────────────────────── */

function OnCourtPanel({
  teamName,
  teamColor,
  players,
  side,
  panelLabel,
}: {
  teamName: string;
  teamColor?: string;
  players: OnCourtPlayer[];
  side: 'left' | 'right';
  panelLabel?: string;
}) {
  const accentColor = teamColor ? `#${teamColor}` : '#6366f1';

  return (
    <div className="hidden lg:flex flex-col w-[180px] flex-shrink-0 bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Team header */}
      <div
        className="px-3 py-2.5 text-center border-b border-slate-700/50"
        style={{ borderBottomColor: `${accentColor}44` }}
      >
        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          {panelLabel ?? (side === 'left' ? 'Away' : 'Home')}
        </div>
        <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">{teamName}</div>
      </div>

      {/* Player list */}
      <div className="flex-1 flex flex-col justify-center py-1.5">
        {players.length === 0 ? (
          <div className="text-slate-600 text-[10px] text-center italic px-2">
            Lineup unavailable
          </div>
        ) : (
          players.map((p, i) => (
            <PlayerRow key={`${p.name}-${i}`} player={p} accentColor={accentColor} />
          ))
        )}
      </div>
    </div>
  );
}

function PlayerRow({ player, accentColor }: { player: OnCourtPlayer; accentColor: string }) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700/20 transition-colors">
      {/* Headshot */}
      <div
        className="relative w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-slate-700/60"
        style={{ borderColor: `${accentColor}55` }}
      >
        {player.headshotUrl && !imgFailed ? (
          <Image
            src={player.headshotUrl}
            alt={player.name}
            width={28}
            height={28}
            className="object-cover w-full h-full"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-300"
            style={{ backgroundColor: `${accentColor}22` }}
          >
            {player.name.charAt(0)}
          </div>
        )}
      </div>

      {/* Name + info */}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-slate-200 font-medium truncate leading-tight">
          {player.name}
        </div>
        <div className="text-[9px] text-slate-500 leading-tight">
          {player.jersey && <span>#{player.jersey}</span>}
          {player.jersey && player.position && <span className="mx-0.5">·</span>}
          {player.position && <span>{player.position}</span>}
        </div>
      </div>
    </div>
  );
}
