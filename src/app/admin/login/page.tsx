import { getSession } from '@/lib/session';
export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import AdminLoginForm from './AdminLoginForm';

export const metadata = {
  title: 'Admin Login - PBL',
};

export default async function AdminLoginPage() {
  const session = await getSession();
  
  if (session?.role === 'admin') {
    redirect('/admin');
  }

  return <AdminLoginForm />;
}
