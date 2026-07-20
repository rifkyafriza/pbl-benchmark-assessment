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
  const { data: existing } = await supabaseAdmin.from('academic_years').select('id').limit(1);
  const { error } = await supabaseAdmin
    .from('academic_years')
    .insert({ name: validName, is_active: !existing || existing.length === 0 });
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
  await supabaseAdmin.from('academic_years').update({ is_active: false }).neq('id', validId);
  await supabaseAdmin.from('academic_years').update({ is_active: true }).eq('id', validId);
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
