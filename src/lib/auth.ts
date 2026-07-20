'use server';
// Auth server actions — username+password only, no email anywhere.
import * as bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { setSessionCookie, clearSessionCookie, getSession } from '@/lib/session';

export type LoginResult = { error: string } | never;

export async function loginAdmin(formData: FormData): Promise<{ error: string } | void> {
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  if (!username || !password) return { error: 'Username and password are required.' };

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, username, password_hash')
    .eq('role', 'admin')
    .eq('username', username)
    .maybeSingle();

  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: 'Invalid username or password.' };
  }

  await setSessionCookie({ id: user.id, role: 'admin', name: user.name });
  redirect('/admin');
}

export async function loginLecturer(formData: FormData): Promise<{ error: string } | void> {
  const username = String(formData.get('username') || '').trim();
  const password = String(formData.get('password') || '');
  if (!username || !password) return { error: 'Username and password are required.' };

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, username, password_hash')
    .eq('role', 'lecturer')
    .eq('username', username)
    .maybeSingle();

  if (!user || !user.password_hash || !(await bcrypt.compare(password, user.password_hash))) {
    return { error: 'Invalid username or password.' };
  }

  await setSessionCookie({ id: user.id, role: 'lecturer', name: user.name });
  redirect('/lecturer/dashboard');
}

export async function logout() {
  await clearSessionCookie();
  redirect('/');
}

// Helper for server components/actions to enforce role. Redirects if unauthorized.
export async function requireRole(role: 'admin' | 'lecturer') {
  const session = await getSession();
  if (!session || session.role !== role) {
    redirect(role === 'admin' ? '/admin/login' : '/lecturer');
  }
  return session;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

// Self-service password change — used by both admin and lecturer accounts.
export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated.');
  if (newPassword.length < 6) throw new Error('New password must be at least 6 characters.');

  const { data: user } = await supabaseAdmin.from('users').select('password_hash').eq('id', session.id).maybeSingle();
  if (!user?.password_hash || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new Error('Current password is incorrect.');
  }

  const password_hash = await bcrypt.hash(newPassword, 12);
  const { error } = await supabaseAdmin.from('users').update({ password_hash }).eq('id', session.id);
  if (error) throw new Error(error.message);
}
