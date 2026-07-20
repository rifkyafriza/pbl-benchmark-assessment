'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole } from '@/lib/auth';

type TeamsImportRow = {
  'TAHUN AJARAN'?: string;
  'KODE'?: string;
  'JUDUL PROJECT'?: string;
  'PIMPRO'?: string;
  'PRODI'?: string;
  'SEMESTER'?: string | number;
  'NIM'?: string | number;
  'NAMA'?: string;
  'KELAS'?: string;
};

export async function importTeamsTemplate(rows: TeamsImportRow[], academicYearId: string) {
  await requireRole('admin');

  const errors: string[] = [];
  const seenTeamCodes = new Set<string>();
  const seenStudents = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2;
    if (!r['KODE'] || !String(r['KODE']).trim()) errors.push(`Row ${line}: missing KODE`);
    if (!r['JUDUL PROJECT'] || !String(r['JUDUL PROJECT']).trim()) errors.push(`Row ${line}: missing JUDUL PROJECT`);
    if (!r['PIMPRO'] || !String(r['PIMPRO']).trim()) errors.push(`Row ${line}: missing PIMPRO`);
    if (!r['NIM'] || !String(r['NIM']).trim()) errors.push(`Row ${line}: missing NIM`);
    if (!r['NAMA'] || !String(r['NAMA']).trim()) errors.push(`Row ${line}: missing NAMA`);
    if (!r['NIM'] || !r['NAMA']) return;

    const nim = String(r['NIM']).trim();
    const name = String(r['NAMA']).trim();
    const studentKey = `${nim}::${name}`;
    if (seenStudents.has(studentKey)) {
      errors.push(`Row ${line}: duplicate student NIM "${nim}" and Name "${name}" already listed in this file`);
    }
    seenStudents.add(studentKey);
    seenTeamCodes.add(String(r['KODE']).trim());
  });

  if (errors.length > 0) return { success: false, error: `Import aborted, no rows were applied. Errors:\n${errors.join('\n')}` };

  const pimproNames = Array.from(new Set(rows.map((r) => String(r['PIMPRO']).trim())));
  const lecturerMap = new Map<string, string>();
  
  const { data: existingLecturers, error: existingLecturersErr } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('role', 'lecturer')
    .in('name', pimproNames);
  if (existingLecturersErr) return { success: false, error: 'Failed to fetch lecturers' };

  const existingLecturersList = existingLecturers || [];
  const existingLecturerNames = new Set(existingLecturersList.map(l => l.name));
  
  const newLecturers = pimproNames.filter(n => !existingLecturerNames.has(n)).map(name => ({ name, role: 'lecturer' }));
  
  if (newLecturers.length > 0) {
    const { data: insertedLecturers, error: insertLecturersErr } = await supabaseAdmin
      .from('users')
      .insert(newLecturers)
      .select('id, name');
    if (insertLecturersErr) return { success: false, error: `Failed to create new lecturers: ${insertLecturersErr.message}` };
    existingLecturersList.push(...(insertedLecturers || []));
  }
  
  existingLecturersList.forEach(l => lecturerMap.set(l.name, l.id));

  const teamRows = Array.from(new Map(rows.map((r) => [`${String(r['KODE']).trim()}_${String(r['JUDUL PROJECT']).trim()}`, r])).values());
  const teamMap = new Map<string, string>();
  
  const teamCodes = teamRows.map(r => String(r['KODE']).trim());
  const { data: existingTeams, error: existingTeamsErr } = await supabaseAdmin
    .from('teams')
    .select('id, team_code, name, is_deleted')
    .eq('academic_year_id', academicYearId)
    .in('team_code', teamCodes);
  if (existingTeamsErr) return { success: false, error: 'Failed to fetch existing teams' };
  
  const existingTeamsList = existingTeams || [];
  const newTeamsToInsert = [];
  const teamsToRestore = [];
  
  for (const r of teamRows) {
    const code = String(r['KODE']).trim();
    const projectName = String(r['JUDUL PROJECT']).trim();
    const existing = existingTeamsList.find(t => t.team_code === code && t.name === projectName);
    
    if (existing) {
      teamMap.set(`${code}_${projectName}`, existing.id);
      if (existing.is_deleted) teamsToRestore.push(existing.id);
    } else {
      newTeamsToInsert.push({ academic_year_id: academicYearId, team_code: code, name: projectName });
    }
  }
  
  if (teamsToRestore.length > 0) {
     const { error: restoreErr } = await supabaseAdmin.from('teams').update({ is_deleted: false }).in('id', teamsToRestore);
     if (restoreErr) return { success: false, error: 'Failed to restore teams' };
  }
  
  if (newTeamsToInsert.length > 0) {
     const { data: insertedTeams, error: insertTeamsErr } = await supabaseAdmin.from('teams').insert(newTeamsToInsert).select('id, team_code, name');
     if (insertTeamsErr) return { success: false, error: `Failed to create new teams: ${insertTeamsErr.message}` };
     insertedTeams?.forEach(t => teamMap.set(`${t.team_code}_${t.name}`, t.id));
  }

  const teamLecturerLinks = [];
  for (const r of teamRows) {
    const code = String(r['KODE']).trim();
    const projectName = String(r['JUDUL PROJECT']).trim();
    const teamId = teamMap.get(`${code}_${projectName}`);
    const lecturerId = lecturerMap.get(String(r['PIMPRO']).trim());
    if (teamId && lecturerId) {
       teamLecturerLinks.push({ team_id: teamId, lecturer_id: lecturerId, role: 'pimpro' });
    }
  }
  
  const teamIds = Array.from(teamMap.values());
  if (teamIds.length > 0) {
    const { data: existingPimproLinks, error: existingPimproLinksErr } = await supabaseAdmin.from('team_lecturers').select('team_id, lecturer_id').eq('role', 'pimpro').in('team_id', teamIds);
    if (existingPimproLinksErr) return { success: false, error: `Failed to fetch existing pimpro links: ${existingPimproLinksErr.message}` };
    const existingPimproMap = new Map((existingPimproLinks || []).map(l => [l.team_id, l]));
    
    const newPimproLinks = [];
    const updatePromises = [];
    for (const link of teamLecturerLinks) {
       const existing = existingPimproMap.get(link.team_id);
       if (existing) {
          if (existing.lecturer_id !== link.lecturer_id) {
             updatePromises.push(supabaseAdmin.from('team_lecturers').update({ lecturer_id: link.lecturer_id }).eq('team_id', existing.team_id).eq('role', 'pimpro'));
          }
       } else {
          newPimproLinks.push(link);
       }
    }
    if (updatePromises.length > 0) await Promise.all(updatePromises);
    if (newPimproLinks.length > 0) {
       const { error: insertPimproErr } = await supabaseAdmin.from('team_lecturers').insert(newPimproLinks);
       if (insertPimproErr) return { success: false, error: `Failed to assign pimpros: ${insertPimproErr.message}` };
    }
  }

  const allNims = Array.from(new Set(rows.map(r => String(r['NIM']).trim())));
  const { data: existingStudents, error: existingStudentsErr } = await supabaseAdmin.from('students').select('id, nim').in('nim', allNims);
  if (existingStudentsErr) return { success: false, error: `Failed to fetch students: ${existingStudentsErr.message}` };
  
  const existingStudentMap = new Map((existingStudents || []).map(s => [s.nim, s.id]));
  const studentsToInsert = [];
  const studentsToUpdate = [];
  
  for (const r of rows) {
    const nim = String(r['NIM']).trim();
    const studentData = {
      nim,
      name: String(r['NAMA']).trim(),
      prodi: r['PRODI'] ? String(r['PRODI']).trim() : null,
      semester: r['SEMESTER'] ? String(r['SEMESTER']).trim() : null,
      kelas: r['KELAS'] ? String(r['KELAS']).trim() : null,
    };
    const existingId = existingStudentMap.get(nim);
    if (existingId) {
      studentsToUpdate.push({ id: existingId, ...studentData });
    } else {
      studentsToInsert.push(studentData);
    }
  }

  if (studentsToInsert.length > 0) {
    const { data: insertedStudents, error: insertStudentsErr } = await supabaseAdmin.from('students').insert(studentsToInsert).select('id, nim');
    if (insertStudentsErr) return { success: false, error: `Failed to insert students: ${insertStudentsErr.message}` };
    insertedStudents?.forEach(s => existingStudentMap.set(s.nim, s.id));
  }
  
  if (studentsToUpdate.length > 0) {
     const { error: updateStudentsErr } = await supabaseAdmin.from('students').upsert(studentsToUpdate);
     if (updateStudentsErr) return { success: false, error: `Failed to update students: ${updateStudentsErr.message}` };
  }
  
  const studentTeamLinks = [];
  for (const r of rows) {
    const nim = String(r['NIM']).trim();
    const teamId = teamMap.get(`${String(r['KODE']).trim()}_${String(r['JUDUL PROJECT']).trim()}`);
    const studentId = existingStudentMap.get(nim);
    if (teamId && studentId) {
       studentTeamLinks.push({ team_id: teamId, student_id: studentId });
    }
  }
  
  if (teamIds.length > 0) {
    const { data: existingStudentLinks, error: existingStudentLinksErr } = await supabaseAdmin.from('team_students').select('team_id, student_id').in('team_id', teamIds);
    if (existingStudentLinksErr) return { success: false, error: `Failed to fetch existing student links: ${existingStudentLinksErr.message}` };
    const existingStudentLinkSet = new Set((existingStudentLinks || []).map(l => `${l.team_id}_${l.student_id}`));
    
    const newStudentLinks = studentTeamLinks.filter(l => !existingStudentLinkSet.has(`${l.team_id}_${l.student_id}`));
    if (newStudentLinks.length > 0) {
       const { error: insertStudentLinkErr } = await supabaseAdmin.from('team_students').insert(newStudentLinks);
       if (insertStudentLinkErr) return { success: false, error: `Failed to insert team-student links: ${insertStudentLinkErr.message}` };
    }
  }

  revalidatePath('/admin');
  return { success: true, teamsProcessed: teamRows.length, studentsProcessed: rows.length };
}

type ReviewersImportRow = {
  'TAHUN AJARAN'?: string;
  'KODE'?: string;
  'JUDUL PROJECT'?: string;
  'REVIEWER 1'?: string;
  'REVIEWER 2'?: string;
  'REVIEWER 3'?: string;
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function resolveLecturer(
  value: string,
  lecturers: { id: string; name: string; username: string | null }[]
): { id: string; name: string } | { error: string } {
  const input = normalize(value);

  const usernameHit = lecturers.find((l) => l.username && normalize(l.username) === input);
  if (usernameHit) return { id: usernameHit.id, name: usernameHit.name };

  const exactNameHit = lecturers.find((l) => normalize(l.name) === input);
  if (exactNameHit) return { id: exactNameHit.id, name: exactNameHit.name };

  const inputWords = input.split(' ').filter(Boolean);
  const candidates = lecturers.filter((l) => {
    const name = normalize(l.name);
    if (name.includes(input)) return true;
    const nameWords = name.split(' ').filter(Boolean);
    return inputWords.every((w) => nameWords.includes(w));
  });

  if (candidates.length === 1) return { id: candidates[0].id, name: candidates[0].name };
  if (candidates.length === 0) return { error: `no lecturer found matching "${value}"` };
  return { error: `"${value}" matches multiple lecturers ambiguously (${candidates.map((c) => c.name).join(', ')}) — use a username or fuller name` };
}

export async function importReviewersTemplate(rows: ReviewersImportRow[], academicYearId: string) {
  await requireRole('admin');

  const { data: lecturers } = await supabaseAdmin.from('users').select('id, name, username').eq('role', 'lecturer');
  const lecturerList = lecturers || [];

  const errors: string[] = [];
  const teamCodeCache = new Map<string, string | null>();
  const toApply: { teamId: string; lecturerId: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    if (!r['KODE'] || !String(r['KODE']).trim()) {
      errors.push(`Row ${line}: missing KODE`);
      continue;
    }
    const code = String(r['KODE']).trim();
    const projectName = r['JUDUL PROJECT'] ? String(r['JUDUL PROJECT']).trim() : '';
    const uniqueKey = `${code}_${projectName}`;
    
    if (!teamCodeCache.has(uniqueKey)) {
      let query = supabaseAdmin.from('teams').select('id').eq('academic_year_id', academicYearId).eq('team_code', code);
      if (projectName) {
        query = query.eq('name', projectName);
      }
      const { data: t } = await query.maybeSingle();
      teamCodeCache.set(uniqueKey, t?.id ?? null);
    }
    const teamId = teamCodeCache.get(uniqueKey);
    if (!teamId) {
      errors.push(`Row ${line}: team "${code}" with project "${projectName}" not found in this tahun ajaran`);
      continue;
    }

    const slots: { label: string; value?: string }[] = [
      { label: 'REVIEWER 1', value: r['REVIEWER 1'] },
      { label: 'REVIEWER 2', value: r['REVIEWER 2'] },
      { label: 'REVIEWER 3', value: r['REVIEWER 3'] },
    ];
    const rowLecturerIds = new Set<string>();
    for (const slot of slots) {
      const raw = slot.value ? String(slot.value).trim() : '';
      if (!raw) continue;
      const resolved = resolveLecturer(raw, lecturerList);
      if ('error' in resolved) {
        errors.push(`Row ${line}: team ${code} ${slot.label}: ${resolved.error}`);
        continue;
      }
      if (rowLecturerIds.has(resolved.id)) {
        errors.push(`Row ${line}: team ${code} ${slot.label}: "${raw}" (${resolved.name}) is already assigned to another reviewer slot in this row`);
        continue;
      }
      rowLecturerIds.add(resolved.id);
      toApply.push({ teamId, lecturerId: resolved.id });
    }
  }

  if (errors.length > 0) return { success: false, error: `Import aborted, no rows were applied. Errors:\n${errors.join('\n')}` };

  if (toApply.length > 0) {
    const { data: existingAll } = await supabaseAdmin.from('team_lecturers').select('team_id, lecturer_id').eq('role', 'reviewer').in('team_id', toApply.map(x => x.teamId));
    const existingSet = new Set((existingAll||[]).map(x => `${x.team_id}_${x.lecturer_id}`));
    const newInserts = toApply.filter(x => !existingSet.has(`${x.teamId}_${x.lecturerId}`));
    if (newInserts.length > 0) {
      await supabaseAdmin.from('team_lecturers').insert(newInserts.map(x => ({ team_id: x.teamId, lecturer_id: x.lecturerId, role: 'reviewer' })));
    }
  }

  revalidatePath('/admin');
  return { success: true, rowsProcessed: rows.length, assignmentsApplied: toApply.length };
}

export async function exportGradesData(academicYearId: string) {
  await requireRole('admin');

  const { data: semester } = await supabaseAdmin.from('academic_years').select('active_period').eq('id', academicYearId).single();
  const activePeriod = semester?.active_period || 'ATS';

  const { data: teams } = await supabaseAdmin.from('teams').select('id, name, team_code').eq('academic_year_id', academicYearId).eq('is_deleted', false);
  if (!teams || teams.length === 0) return [];
  const teamIds = teams.map((t) => t.id);

  const { data: teamStudents } = await supabaseAdmin.from('team_students').select('team_id, student_id, students(name, nim)').in('team_id', teamIds);
  const { data: grades } = await supabaseAdmin.from('grades').select('*').in('team_id', teamIds).eq('period', activePeriod);
  const lecturerIds = Array.from(new Set((grades || []).map((g) => g.lecturer_id).filter(Boolean)));
  const { data: lecturers } = lecturerIds.length
    ? await supabaseAdmin.from('users').select('id, name').in('id', lecturerIds)
    : { data: [] as any[] };

  const rows: any[] = [];
  for (const ts of teamStudents || []) {
    const team = teams.find((t) => t.id === ts.team_id);
    const student = ts.students as any;
    const studentGrades = (grades || []).filter((g) => g.team_id === ts.team_id && g.student_id === ts.student_id);

    if (studentGrades.length === 0) {
      rows.push({
        'Team Code': team?.team_code || '',
        'Team Name': team?.name || '',
        'Student NIM': student?.nim || '',
        'Student Name': student?.name || '',
        Period: activePeriod,
        Reviewer: '',
        'Implementation Score': '',
        'Document Score': '',
        'English Score': '',
        Comment: '',
        Status: 'Not Graded',
      });
      continue;
    }

    for (const g of studentGrades) {
      const lecturer = lecturers?.find((l) => l.id === g.lecturer_id);
      rows.push({
        'Team Code': team?.team_code || '',
        'Team Name': team?.name || '',
        'Student NIM': student?.nim || '',
        'Student Name': student?.name || '',
        Period: g.period || 'ATS',
        Reviewer: lecturer?.name || 'Unknown',
        'Implementation Score': g.implementation_score ?? '',
        'Document Score': g.document_score ?? '',
        'English Score': g.english_score ?? '',
        Comment: g.comment || '',
        Status: g.is_locked ? 'Locked' : 'Draft',
      });
    }
  }
  return rows;
}
