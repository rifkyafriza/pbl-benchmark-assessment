'use server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { requireRole, hashPassword } from '@/lib/auth';

// ---------- Semesters ----------
export async function listSemesters() {
  await requireRole('admin');
  const { data } = await supabaseAdmin.from('academic_years').select('*').order('name');
  return data || [];
}

export async function addSemester(name: string) {
  await requireRole('admin');
  const { data: existing } = await supabaseAdmin.from('academic_years').select('id').limit(1);
  const { error } = await supabaseAdmin
    .from('academic_years')
    .insert({ name: name.trim(), is_active: !existing || existing.length === 0 });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function deleteSemester(id: string) {
  await requireRole('admin');
  const { error } = await supabaseAdmin.from('academic_years').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function setActiveSemester(id: string) {
  await requireRole('admin');
  await supabaseAdmin.from('academic_years').update({ is_active: false }).neq('id', id);
  await supabaseAdmin.from('academic_years').update({ is_active: true }).eq('id', id);
  revalidatePath('/admin');
}

// Sets which assessment round (ATS = mid-semester, AAS = end-semester) is currently
// active for a given semester. Per-semester, not global — each semester row tracks
// its own active_period. Grades/progress everywhere filter by this value.
export async function setActivePeriod(academicYearId: string, period: 'ATS' | 'AAS') {
  await requireRole('admin');
  const { error } = await supabaseAdmin.from('academic_years').update({ active_period: period }).eq('id', academicYearId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// ---------- Lecturer accounts (created by admin, username+password, no email) ----------
export async function listLecturerAccounts() {
  await requireRole('admin');
  const { data } = await supabaseAdmin.from('users').select('id, name, username, initials').eq('role', 'lecturer').order('name');
  return data || [];
}

export async function createLecturerAccount(name: string, username: string, password: string) {
  await requireRole('admin');
  if (!name.trim() || !username.trim() || password.length < 6) {
    throw new Error('Name, username, and a password of at least 6 characters are required.');
  }
  const password_hash = await hashPassword(password);
  const { error } = await supabaseAdmin
    .from('users')
    .insert({ name: name.trim(), username: username.trim(), password_hash, role: 'lecturer' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function resetLecturerPassword(userId: string, newPassword: string) {
  await requireRole('admin');
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  const password_hash = await hashPassword(newPassword);
  const { error } = await supabaseAdmin.from('users').update({ password_hash }).eq('id', userId).eq('role', 'lecturer');
  if (error) throw new Error(error.message);
}

// Edit a lecturer's name/username, and optionally reset their password in the same call
// (blank newPassword = leave password_hash unchanged). Used by the admin's edit modal.
export async function updateLecturerAccount(
  userId: string,
  data: { name: string; username: string; newPassword?: string }
) {
  await requireRole('admin');
  const name = data.name.trim();
  const username = data.username.trim();
  if (!name || !username) throw new Error('Name and username are required.');
  if (data.newPassword && data.newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const { data: taken } = await supabaseAdmin.from('users').select('id').eq('username', username).neq('id', userId).maybeSingle();
  if (taken) throw new Error('Username is already taken.');

  const update: Record<string, string> = { name, username };
  if (data.newPassword) update.password_hash = await hashPassword(data.newPassword);

  const { error } = await supabaseAdmin.from('users').update(update).eq('id', userId).eq('role', 'lecturer');
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// Number of grade rows submitted by this lecturer — shown in the delete confirmation
// so the admin knows how much will be cascade-deleted before confirming.
export async function getLecturerGradeCount(userId: string) {
  await requireRole('admin');
  const { count } = await supabaseAdmin.from('grades').select('*', { count: 'exact', head: true }).eq('lecturer_id', userId);
  return count || 0;
}

// Deletes a lecturer account. grades.lecturer_id and team_lecturers.lecturer_id both have
// ON DELETE CASCADE, so this also removes any grades/assignments tied to them — the caller
// must confirm with the admin (via getLecturerGradeCount) before calling this.
export async function deleteLecturerAccount(userId: string) {
  await requireRole('admin');
  const { error } = await supabaseAdmin.from('users').delete().eq('id', userId).eq('role', 'lecturer');
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// ---------- Progress / unlock ----------
// NOTE: bypasses the `lecturer_progress` view — that view joins team_lecturers
// without filtering by role, so a team's pimpro row was showing up mixed into
// "reviewer" progress rows. Query reviewer assignments explicitly instead, and
// bring in pimpro name as a separate column.
export async function getProgress(academicYearId: string) {
  await requireRole('admin');

  // Progress is always scoped to the semester's currently active period (ATS/AAS) —
  // the semester row is the single source of truth, so switching active_period alone
  // (no semester change) still yields fresh data on the caller's next fetch.
  const [
    { data: semester },
    { data: teams }
  ] = await Promise.all([
    supabaseAdmin.from('academic_years').select('active_period').eq('id', academicYearId).single(),
    supabaseAdmin.from('teams').select('id, name, team_code').eq('academic_year_id', academicYearId).eq('is_deleted', false)
  ]);
  const period = semester?.active_period || 'ATS';

  if (!teams || teams.length === 0) return [];
  const teamIds = teams.map((t) => t.id);

  const [
    { data: assignments },
    { data: teamStudentCounts },
    { data: grades }
  ] = await Promise.all([
    supabaseAdmin.from('team_lecturers').select('team_id, lecturer_id, role, users(name)').in('team_id', teamIds),
    supabaseAdmin.from('team_students').select('team_id, students(kelas)').in('team_id', teamIds),
    supabaseAdmin.from('grades').select('team_id, lecturer_id, is_locked').in('team_id', teamIds).eq('period', period)
  ]);

  const totalByTeam = new Map<string, number>();
  const kelasByTeam = new Map<string, string>();
  (teamStudentCounts || []).forEach((r: any) => {
    totalByTeam.set(r.team_id, (totalByTeam.get(r.team_id) || 0) + 1);
    if (r.students?.kelas && !kelasByTeam.has(r.team_id)) {
      kelasByTeam.set(r.team_id, r.students.kelas);
    }
  });

  const pimproByTeam = new Map<string, { id: string; name: string }>();
  const reviewerRows: { team_id: string; lecturer_id: string; lecturer_name: string }[] = [];
  (assignments || []).forEach((a: any) => {
    if (a.role === 'pimpro') pimproByTeam.set(a.team_id, { id: a.lecturer_id, name: a.users?.name || 'Unknown' });
    if (a.role === 'reviewer') reviewerRows.push({ team_id: a.team_id, lecturer_id: a.lecturer_id, lecturer_name: a.users?.name || 'Unknown' });
  });

  // One progress row per team, carrying up to 3 reviewer slots (array, index 0-2)
  // instead of one row per reviewer — lets the admin UI render 3 fixed dropdowns
  // and per-reviewer completion status regardless of how many (0-3) are assigned.
  return teams.map((t) => {
    const reviewersForTeam = reviewerRows.filter((r) => r.team_id === t.id);
    const totalStudents = totalByTeam.get(t.id) || 0;
    const pimpro = pimproByTeam.get(t.id) || null;

    const reviewers = reviewersForTeam.map((r) => {
      const teamGrades = (grades || []).filter((g) => g.team_id === t.id && g.lecturer_id === r.lecturer_id);
      const finalized = teamGrades.filter((g) => g.is_locked).length;
      const status = teamGrades.length === 0 ? 'Not Started' : finalized === totalStudents && totalStudents > 0 ? 'Completed' : 'In Progress';
      return {
        lecturer_id: r.lecturer_id, lecturer_name: r.lecturer_name,
        graded_students: teamGrades.length, finalized_students: finalized, status,
      };
    });

    return {
      team_id: t.id, team_name: t.name, team_code: t.team_code, academic_year_id: academicYearId,
      pimpro_id: pimpro?.id ?? null, pimpro_name: pimpro?.name ?? null,
      team_kelas: kelasByTeam.get(t.id) ?? null,
      total_students: totalStudents, reviewers,
    };
  });
}

// Full lecturer list (id + name) for the admin's reviewer/pimpro assignment dropdowns.
export async function listAllLecturers() {
  await requireRole('admin');
  const { data } = await supabaseAdmin.from('users').select('id, name').eq('role', 'lecturer').order('name');
  return data || [];
}

// Inline-editable pimpro assignment: sets (or clears) the pimpro for a team.
// Reviewer assignment now goes through setTeamReviewer (3 independent slots).
export async function setTeamAssignment(teamId: string, role: 'pimpro', lecturerId: string | null) {
  await requireRole('admin');
  const { error: delError } = await supabaseAdmin.from('team_lecturers').delete().eq('team_id', teamId).eq('role', role);
  if (delError) throw new Error(delError.message);
  if (lecturerId) {
    const { error } = await supabaseAdmin.from('team_lecturers').insert({ team_id: teamId, lecturer_id: lecturerId, role });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin');
}

// Sets (or clears) one of a team's 3 reviewer slots. Slots aren't stored by index —
// they're just "the current set of reviewer rows for this team", so we identify the
// slot being edited by the lecturer_id currently occupying it (previousLecturerId).
// Server-side enforces: the same lecturer cannot occupy 2 reviewer slots for one team.
export async function setTeamReviewer(teamId: string, previousLecturerId: string | null, newLecturerId: string | null) {
  await requireRole('admin');

  if (newLecturerId) {
    const { data: existing } = await supabaseAdmin
      .from('team_lecturers')
      .select('lecturer_id')
      .eq('team_id', teamId)
      .eq('role', 'reviewer')
      .neq('lecturer_id', previousLecturerId ?? '00000000-0000-0000-0000-000000000000');
    if ((existing || []).some((r) => r.lecturer_id === newLecturerId)) {
      throw new Error('This lecturer is already assigned as a reviewer for this team in another slot.');
    }
  }

  if (previousLecturerId) {
    const { error: delError } = await supabaseAdmin
      .from('team_lecturers').delete()
      .eq('team_id', teamId).eq('role', 'reviewer').eq('lecturer_id', previousLecturerId);
    if (delError) throw new Error(delError.message);
  }
  if (newLecturerId) {
    const { error } = await supabaseAdmin.from('team_lecturers').insert({ team_id: teamId, lecturer_id: newLecturerId, role: 'reviewer' });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin');
}

export async function getTeamCount(academicYearId: string) {
  await requireRole('admin');
  const { count } = await supabaseAdmin
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('academic_year_id', academicYearId)
    .eq('is_deleted', false);
  return count || 0;
}

// Unlocks a locked (team, reviewer) score-set so the reviewer can resubmit.
// Scoped to the given semester's currently active period only — unlocking ATS
// must never touch AAS grades for the same team+reviewer, and vice versa.
export async function unlockTeamReviewer(teamId: string, lecturerId: string, academicYearId: string) {
  await requireRole('admin');
  const { data: semester } = await supabaseAdmin.from('academic_years').select('active_period').eq('id', academicYearId).single();
  const period = semester?.active_period || 'ATS';
  const { error } = await supabaseAdmin
    .from('grades')
    .update({ is_locked: false })
    .eq('team_id', teamId)
    .eq('lecturer_id', lecturerId)
    .eq('period', period);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

// ---------- Import: teams + students + pimpro ----------
// Template columns: SEMESTER, KODE, JUDUL PROJECT, PIMPRO, PRODI, SEMESTER, NIM, NAMA, KELAS
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

  // Validate ALL rows first — abort entirely on any failure (no partial import).
  const errors: string[] = [];
  const seenTeamCodes = new Set<string>();
  const seenStudents = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 2; // +1 header, +1 to make it 1-indexed data row
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

  // 1. Upsert pimpro lecturer accounts
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

  // 2. Upsert teams (unique per academic_year_id + team_code + name)
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

  // 2.5 Assign pimpros
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
    for (const link of teamLecturerLinks) {
       const existing = existingPimproMap.get(link.team_id);
       if (existing) {
          if (existing.lecturer_id !== link.lecturer_id) {
             await supabaseAdmin.from('team_lecturers').update({ lecturer_id: link.lecturer_id }).eq('team_id', existing.team_id).eq('role', 'pimpro');
          }
       } else {
          newPimproLinks.push(link);
       }
    }
    if (newPimproLinks.length > 0) {
       const { error: insertPimproErr } = await supabaseAdmin.from('team_lecturers').insert(newPimproLinks);
       if (insertPimproErr) return { success: false, error: `Failed to assign pimpros: ${insertPimproErr.message}` };
    }
  }

  // 3. Upsert students + link to team
  const allNims = Array.from(new Set(rows.map(r => String(r['NIM']).trim())));
  // If nims > 1000, we should chunk it, but 510 is fine.
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
  
  // Create student-team links
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

// ---------- Import: reviewer assignments ----------
// Template columns: semester_label, team_code, reviewer_1, reviewer_2, reviewer_3
// Each reviewer cell accepts a username OR a full/partial lecturer name (fuzzy match).
type ReviewersImportRow = {
  'TAHUN AJARAN'?: string;
  'KODE'?: string;
  'JUDUL PROJECT'?: string;
  'REVIEWER 1'?: string;
  'REVIEWER 2'?: string;
  'REVIEWER 3'?: string;
};

// Normalize for matching: lowercase, collapse whitespace.
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

// Resolve one reviewer cell value against the lecturer list.
// Priority: exact username match > exact full-name match > partial/subset-of-words name match.
// Returns the matched lecturer, or an error string describing why (not found / ambiguous).
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
  // Resolved assignments to apply after full validation: one entry per (row, slot).
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
      if (!raw) continue; // blank = no reviewer in this slot for this row
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

  for (const { teamId, lecturerId } of toApply) {
    const { data: existing } = await supabaseAdmin
      .from('team_lecturers')
      .select('team_id')
      .eq('team_id', teamId)
      .eq('lecturer_id', lecturerId)
      .eq('role', 'reviewer')
      .maybeSingle();
    if (!existing) {
      await supabaseAdmin.from('team_lecturers').insert({ team_id: teamId, lecturer_id: lecturerId, role: 'reviewer' });
    }
  }

  revalidatePath('/admin');
  return { success: true, rowsProcessed: rows.length, assignmentsApplied: toApply.length };
}

// ---------- Export ----------
// Exports grades for the currently active period (ATS or AAS) for the semester.
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

// ---------- Team Management ----------

export async function deleteTeam(teamId: string) {
  await requireRole('admin');
  
  // Check if team has any grades
  const { count, error: countError } = await supabaseAdmin
    .from('grades')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', teamId);
    
  if (countError) throw new Error(countError.message);

  if (count && count > 0) {
    // Soft delete to preserve grades
    const { error } = await supabaseAdmin.from('teams').update({ is_deleted: true }).eq('id', teamId);
    if (error) throw new Error(error.message);
  } else {
    // Hard delete since there's no grades
    // Manually delete related records first to prevent foreign key constraint errors (if ON DELETE CASCADE is missing)
    await supabaseAdmin.from('team_students').delete().eq('team_id', teamId);
    await supabaseAdmin.from('team_lecturers').delete().eq('team_id', teamId);
    const { error } = await supabaseAdmin.from('teams').delete().eq('id', teamId);
    if (error) throw new Error(error.message);
  }
  
  revalidatePath('/admin');
}

export async function getTeamStudents(teamId: string) {
  await requireRole('admin');
  const { data: teamStudents, error } = await supabaseAdmin
    .from('team_students')
    .select('student_id, students(nim, name, prodi, semester, kelas)')
    .eq('team_id', teamId);
  if (error) throw new Error(error.message);
  return (teamStudents || []).map((ts: any) => ({
    id: ts.student_id,
    nim: ts.students.nim,
    name: ts.students.name,
    prodi: ts.students.prodi,
    semester: ts.students.semester,
    kelas: ts.students.kelas,
  }));
}

export async function updateStudent(studentId: string, nim: string, name: string, prodi?: string, semester?: string, kelas?: string) {
  await requireRole('admin');
  const { error } = await supabaseAdmin.from('students').update({ 
    nim: nim.trim(), 
    name: name.trim(),
    prodi: prodi?.trim() || null,
    semester: semester?.trim() || null,
    kelas: kelas?.trim() || null
  }).eq('id', studentId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}

export async function addStudentToTeam(teamId: string, nim: string, name: string, prodi?: string, semester?: string, kelas?: string) {
  await requireRole('admin');
  const cleanNim = nim.trim();
  const cleanName = name.trim();
  const studentData = {
    nim: cleanNim,
    name: cleanName,
    prodi: prodi?.trim() || null,
    semester: semester?.trim() || null,
    kelas: kelas?.trim() || null
  };
  
  // Find or create student
  let { data: student } = await supabaseAdmin.from('students').select('id').eq('nim', cleanNim).maybeSingle();
  if (!student) {
    const { data, error } = await supabaseAdmin.from('students').insert(studentData).select('id').single();
    if (error) throw new Error(error.message);
    student = data;
  } else {
    // Optionally update name if different, but let's just use existing for now
    await supabaseAdmin.from('students').update(studentData).eq('id', student.id);
  }

  // Link to team
  const { data: link } = await supabaseAdmin.from('team_students').select('team_id').eq('team_id', teamId).eq('student_id', student!.id).maybeSingle();
  if (!link) {
    const { error } = await supabaseAdmin.from('team_students').insert({ team_id: teamId, student_id: student!.id });
    if (error) throw new Error(error.message);
  }
  revalidatePath('/admin');
}

export async function removeStudentFromTeam(teamId: string, studentId: string) {
  await requireRole('admin');
  const { error } = await supabaseAdmin.from('team_students').delete().eq('team_id', teamId).eq('student_id', studentId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}
