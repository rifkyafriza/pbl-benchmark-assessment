import { getSession } from '@/lib/session';
export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import LecturerLoginForm from './LecturerLoginForm';

export const metadata = {
  title: 'Lecturer Login - PBL',
};

export default async function LecturerLoginPage() {
  const session = await getSession();
  
  if (session?.role === 'lecturer') {
    redirect('/lecturer/dashboard');
  }

  return <LecturerLoginForm />;
}
