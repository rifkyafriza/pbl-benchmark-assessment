'use client';
import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight } from 'lucide-react';

export default function TeamList({ teams }: { teams: any[] }) {
  const [kelasFilter, setKelasFilter] = useState<string>('Semua');

  const filteredTeams = teams.filter((p) => {
    if (kelasFilter === 'Semua') return true;
    if (kelasFilter === 'Pagi') return p.team_kelas?.toLowerCase().includes('pagi');
    if (kelasFilter === 'Malam') return p.team_kelas?.toLowerCase().includes('malam');
    return true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium text-gray-700 dark:text-gray-200">Select a team to review</h2>
        <select
          value={kelasFilter}
          onChange={(e) => setKelasFilter(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700 bg-white"
        >
          <option value="Semua">Semua Kelas</option>
          <option value="Pagi">Kelas Pagi</option>
          <option value="Malam">Kelas Malam</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTeams.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            {teams.length === 0 ? 'No teams assigned to you as reviewer for the active semester.' : 'No teams match the selected class filter.'}
          </div>
        ) : (
          filteredTeams.map((team: any, i: number) => (
            <Link 
              prefetch={true} 
              key={team.id} 
              href={`/lecturer/team/${team.id}`} 
              className="bg-white dark:bg-gray-800 p-6 rounded-2xl antigravity-shadow antigravity-hover border border-white dark:border-gray-700/50 cursor-pointer group block opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-sky/10 text-sky rounded-xl">
                  <BookOpen size={24} />
                </div>
                <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-sky transition-colors" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{team.team_code} {team.team_kelas ? `— ${team.team_kelas}` : ''}</p>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{team.name}</h2>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
