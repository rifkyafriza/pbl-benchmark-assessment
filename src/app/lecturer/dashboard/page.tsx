import { getMyReviewTeams } from '@/lib/lecturerActions';
import { logout } from '@/lib/auth';
import { LogOut } from 'lucide-react';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import TeamList from './TeamList';

export default async function LecturerDashboard() {
  const { lecturerName, teams } = await getMyReviewTeams();

  return (
    <div className="min-h-screen p-4 sm:p-8 max-w-4xl mx-auto relative">
      {/* Ambient Background Orbs */}
      <div className="fixed top-0 left-1/4 w-[800px] h-[800px] bg-sky/5 dark:bg-sky/10 rounded-full blur-[100px] -z-10 pointer-events-none translate-x-[-50%]"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-orange/5 dark:bg-orange/10 rounded-full blur-[80px] -z-10 pointer-events-none translate-x-[50%]"></div>
      <header className="flex justify-between items-center mb-8 pt-4">
        <div>
          <h1 className="text-2xl font-bold text-navy dark:text-sky">Welcome, {lecturerName}</h1>
          <p className="text-gray-600 dark:text-gray-400">Teams you are assigned to review</p>
        </div>
        <div className="flex items-center gap-4">
          <ChangePasswordForm />
          <form action={logout}>
            <button type="submit" className="text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 flex items-center gap-1 text-sm font-medium">
              <LogOut size={16} /> Logout
            </button>
          </form>
        </div>
      </header>

      <TeamList teams={teams} />
    </div>
  );
}
