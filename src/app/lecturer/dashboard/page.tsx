import { getMyReviewTeams } from '@/lib/lecturerActions';
import { logout } from '@/lib/auth';
import { LogOut } from 'lucide-react';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import TeamList from './TeamList';

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

      <TeamList teams={teams} />
    </div>
  );
}
