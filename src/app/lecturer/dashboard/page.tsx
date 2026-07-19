import { getMyReviewTeams } from '@/lib/lecturerActions';
import { logout } from '@/lib/auth';
import Link from 'next/link';
import { BookOpen, LogOut, ChevronRight } from 'lucide-react';
import ChangePasswordForm from '@/components/ChangePasswordForm';

export default async function LecturerDashboard() {
  const { lecturerName, teams } = await getMyReviewTeams();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Welcome, {lecturerName}</h1>
          <p className="text-gray-600">Teams you are assigned to review</p>
        </div>
        <div className="flex items-center gap-4">
          <ChangePasswordForm />
          <form action={logout}>
            <button type="submit" className="text-gray-500 hover:text-red-500 flex items-center gap-1 text-sm font-medium">
              <LogOut size={16} /> Logout
            </button>
          </form>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teams.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
            No teams assigned to you as reviewer for the active semester.
          </div>
        ) : (
          teams.map((team: any) => (
            <Link key={team.id} href={`/lecturer/team/${team.id}`} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-sky hover:shadow-md transition-all cursor-pointer group block">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-sky/10 text-sky rounded-lg">
                  <BookOpen size={24} />
                </div>
                <ChevronRight className="text-gray-300 group-hover:text-sky transition-colors" />
              </div>
              <p className="text-xs text-gray-500 font-medium">{team.team_code}</p>
              <h2 className="text-lg font-bold text-gray-900 mb-1">{team.name}</h2>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
