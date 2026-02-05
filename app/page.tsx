'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchScoreboard } from '@/lib/api';
import Image from 'next/image';

export default function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['scoreboard'],
    queryFn: fetchScoreboard,
  });

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
          <h1 className="text-5xl md:text-6xl font-black mb-3 bg-gradient-to-r from-orange-400 via-red-500 to-purple-600 bg-clip-text text-transparent">
            NBA LIVE
          </h1>
          <p className="text-slate-400 text-lg">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
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
              
              return (
                <div
                  key={game.id}
                  className="group relative bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 hover:border-slate-600/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-900/20"
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
                    <div className="text-slate-400 text-sm font-medium">
                      {game.status.type.shortDetail}
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
                              {homeTeam.team.abbreviation}
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
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
