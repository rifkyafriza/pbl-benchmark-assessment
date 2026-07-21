'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/auth';
import { z } from 'zod';

const idSchema = z.string().uuid('Invalid ID format');
const semesterNameSchema = z.string().min(1, 'Semester name is required').max(100, 'Semester name is too long');
const periodSchema = z.enum(['ATS', 'AAS']);


export async function listSemesters() {
  await requireRole('admin');
  const { data } = await supabaseAdmin.from('academic_years').select('*').order('name');
  return data || [];
}

export async function addSemester(name: string) {
  await requireRole('admin');
  const validName = semesterNameSchema.parse(name.trim());
  // Auto-activate only if no semester is currently active
  const { data: activeOne } = await supabaseAdmin.from('academic_years').select('id').eq('is_active', true).limit(1);
  const shouldAutoActivate = !activeOne || activeOne.length === 0;
  const { error } = await supabaseAdmin
    .from('academic_years')
    .insert({ name: validName, is_active: shouldAutoActivate });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function deleteSemester(id: string) {
  await requireRole('admin');
  const validId = idSchema.parse(id);
  const { error } = await supabaseAdmin.from('academic_years').delete().eq('id', validId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function setActiveSemester(id: string) {
  await requireRole('admin');
  const validId = idSchema.parse(id);
  // Single atomic UPDATE via RPC — avoids the race where two statements could
  // leave zero active semesters if the second UPDATE fails.
  const { error } = await supabaseAdmin.rpc('set_active_semester', { target_id: validId });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function setActivePeriod(academicYearId: string, period: 'ATS' | 'AAS') {
  await requireRole('admin');
  const validId = idSchema.parse(academicYearId);
  const validPeriod = periodSchema.parse(period);
  const { error } = await supabaseAdmin.from('academic_years').update({ active_period: validPeriod }).eq('id', validId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}
