'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole, hashPassword } from '@/lib/auth';
import { z } from 'zod';

const idSchema = z.string().uuid('Invalid ID format');
const lecturerAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  username: z.string().min(1, 'Username is required').max(100, 'Username is too long'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});


export async function listLecturerAccounts() {
  await requireRole('admin');
  const { data } = await supabaseAdmin.from('users').select('id, name, username, initials').eq('role', 'lecturer').order('name');
  return data || [];
}

export async function createLecturerAccount(name: string, username: string, password: string) {
  await requireRole('admin');
  
  const parsed = lecturerAccountSchema.parse({ name: name.trim(), username: username.trim(), password });
  if (!parsed.password) throw new Error('Password is required');
  
  const password_hash = await hashPassword(parsed.password);
  const { error } = await supabaseAdmin
    .from('users')
    .insert({ name: parsed.name, username: parsed.username, password_hash, role: 'lecturer' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function resetLecturerPassword(userId: string, newPassword: string) {
  await requireRole('admin');
  const validId = idSchema.parse(userId);
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  const password_hash = await hashPassword(newPassword);
  const { error } = await supabaseAdmin.from('users').update({ password_hash }).eq('id', validId).eq('role', 'lecturer');
  if (error) throw new Error(error.message);
}

export async function updateLecturerAccount(
  userId: string,
  data: { name: string; username: string; newPassword?: string }
) {
  await requireRole('admin');
  const validId = idSchema.parse(userId);
  const parsed = lecturerAccountSchema.parse({ name: data.name.trim(), username: data.username.trim(), password: data.newPassword });

  const { data: taken } = await supabaseAdmin.from('users').select('id').eq('username', parsed.username).neq('id', validId).maybeSingle();
  if (taken) throw new Error('Username is already taken.');

  const update: Record<string, string> = { name: parsed.name, username: parsed.username };
  if (parsed.password) update.password_hash = await hashPassword(parsed.password);

  const { error } = await supabaseAdmin.from('users').update(update).eq('id', validId).eq('role', 'lecturer');
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function getLecturerGradeCount(userId: string) {
  await requireRole('admin');
  const validId = idSchema.parse(userId);
  const { count } = await supabaseAdmin.from('grades').select('*', { count: 'exact', head: true }).eq('lecturer_id', validId);
  return count || 0;
}

export async function deleteLecturerAccount(userId: string) {
  await requireRole('admin');
  const validId = idSchema.parse(userId);
  const { error } = await supabaseAdmin.from('users').delete().eq('id', validId).eq('role', 'lecturer');
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function listAllLecturers() {
  await requireRole('admin');
  const { data } = await supabaseAdmin.from('users').select('id, name').eq('role', 'lecturer').order('name');
  return data || [];
}
