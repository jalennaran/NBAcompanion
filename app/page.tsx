'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchScoreboard } from '@/lib/api';

export default function Home() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['scoreboard'],
    queryFn: fetchScoreboard,
  });

  if (isLoading) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-6">NBA Companion</h1>
        <p>Loading games...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-8">
        <h1 className="text-3xl font-bold mb-6">NBA Companion</h1>
        <p className="text-red-600">Error loading games: {error.message}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-6">NBA Companion</h1>
      
      <div className="space-y-4">
        {data?.events?.length === 0 ? (
          <p>No games scheduled today</p>
        ) : (
          data?.events?.map((game) => (
            <div
              key={game.id}
              className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  {game.competitions[0].competitors.map((team) => (
                    <div key={team.id} className="flex items-center gap-2 py-1">
                      <span className="font-semibold w-32">
                        {team.team.abbreviation}
                      </span>
                      <span className="text-2xl font-bold">{team.score}</span>
                    </div>
                  ))}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {game.status.type.shortDetail}
                  </p>
                  {game.status.type.completed && (
                    <p className="text-xs text-gray-500">Final</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
