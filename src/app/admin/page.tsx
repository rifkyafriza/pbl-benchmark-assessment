'use client';

import { useState, useEffect, useRef } from 'react';
import { logout } from '@/lib/auth';
import {
  listSemesters, addSemester, deleteSemester, setActiveSemester, setActivePeriod,
  listLecturerAccounts, createLecturerAccount,
  updateLecturerAccount, getLecturerGradeCount, deleteLecturerAccount,
  getProgress, getTeamCount, unlockTeamReviewer, listAllLecturers, setTeamAssignment, setTeamReviewer,
  importTeamsTemplate, importReviewersTemplate, exportGradesData,
  deleteTeam, getTeamStudents, updateStudent, addStudentToTeam, removeStudentFromTeam,
} from '@/lib/adminActions';
import { Upload, Users, BookOpen, Loader2, Download, Trash2, CheckCircle, Plus, Unlock, LogOut, UserPlus, Pencil } from 'lucide-react';
import * as XLSX from 'xlsx';
import ChangePasswordForm from '@/components/ChangePasswordForm';

type Semester = { id: string; name: string; is_active: boolean; active_period: 'ATS' | 'AAS' };
type ReviewerProgress = { lecturer_id: string; lecturer_name: string; graded_students: number; finalized_students: number; status: string };
type TeamProgress = {
  team_id: string; team_name: string; team_code: string; academic_year_id: string;
  pimpro_id: string | null; pimpro_name: string | null; team_kelas: string | null;
  total_students: number; reviewers: ReviewerProgress[];
};
type LecturerAccount = { id: string; name: string; username: string | null; initials: string | null };
type LecturerOption = { id: string; name: string };

export default function AdminDashboard() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemesterId, setActiveSemesterId] = useState<string>('');
  const [newSemesterName, setNewSemesterName] = useState('');

  const [progress, setProgress] = useState<TeamProgress[]>([]);
  const [lecturers, setLecturers] = useState<LecturerAccount[]>([]);
  const [lecturerOptions, setLecturerOptions] = useState<LecturerOption[]>([]);
  const [newLecturerName, setNewLecturerName] = useState('');
  const [newLecturerUsername, setNewLecturerUsername] = useState('');
  const [newLecturerPassword, setNewLecturerPassword] = useState('');
  const [editingLecturer, setEditingLecturer] = useState<LecturerAccount | null>(null);
  const [editingTeam, setEditingTeam] = useState<TeamProgress | null>(null);
  const [kelasFilter, setKelasFilter] = useState<string>('Semua');

  const [loading, setLoading] = useState(true);
  const [isImportingTeams, setIsImportingTeams] = useState(false);
  const [isImportingReviewers, setIsImportingReviewers] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [totalTeams, setTotalTeams] = useState(0);
  const teamsFileRef = useRef<HTMLInputElement>(null);
  const reviewersFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [sems, lecs, opts] = await Promise.all([
        listSemesters(),
        listLecturerAccounts(),
        listAllLecturers()
      ]);
      setSemesters(sems);
      const active = sems.find((s) => s.is_active) || sems[0];
      if (active) setActiveSemesterId(active.id);
      setLecturers(lecs);
      setLecturerOptions(opts);
      setLoading(false);
    })();
  }, []);

  // Re-fetch progress whenever the selected/active semester changes (covers bug #6:
  // switching active semester must re-filter this table).
  useEffect(() => {
    if (!activeSemesterId) { setProgress([]); setTotalTeams(0); return; }
    (async () => {
      setLoading(true);
      const [prog, count] = await Promise.all([
        getProgress(activeSemesterId),
        getTeamCount(activeSemesterId)
      ]);
      setProgress(prog);
      setTotalTeams(count);
      setLoading(false);
    })();
  }, [activeSemesterId]);

  const handlePimproChange = async (teamId: string, lecturerId: string) => {
    const newPimpro = lecturerOptions.find(l => l.id === lecturerId);
    setProgress(prev => prev.map(p => 
      p.team_id === teamId 
        ? { ...p, pimpro_id: newPimpro?.id || null, pimpro_name: newPimpro?.name || null } 
        : p
    ));
    
    try {
      await setTeamAssignment(teamId, 'pimpro', lecturerId || null);
      getProgress(activeSemesterId).then(setProgress); // background sync
    } catch (e: any) { 
      alert('Error updating assignment: ' + e.message); 
      getProgress(activeSemesterId).then(setProgress); // revert on error
    }
  };

  const handleReviewerChange = async (teamId: string, previousLecturerId: string | null, newLecturerId: string) => {
    const newLecturer = lecturerOptions.find(l => l.id === newLecturerId);
    
    setProgress(prev => prev.map(p => {
      if (p.team_id !== teamId) return p;
      // Replace the slot where the previous reviewer was
      const updatedReviewers = p.reviewers.map(r => {
        if (r.lecturer_id === previousLecturerId) {
          return {
            ...r,
            lecturer_id: newLecturer?.id || '',
            lecturer_name: newLecturer?.name || 'Unknown',
            // A new reviewer starts with 0 graded students. If they are swapped back, it will resync via the background fetch anyway.
            graded_students: 0,
            finalized_students: 0,
            status: 'Not Started'
          };
        }
        return r;
      });
      // If we are ADDING a new reviewer (previousLecturerId was null/empty)
      if (!previousLecturerId && newLecturer) {
        updatedReviewers.push({
          lecturer_id: newLecturer.id,
          lecturer_name: newLecturer.name,
          graded_students: 0,
          finalized_students: 0,
          status: 'Not Started'
        });
      }
      return { ...p, reviewers: updatedReviewers };
    }));

    try {
      await setTeamReviewer(teamId, previousLecturerId, newLecturerId || null);
      getProgress(activeSemesterId).then(setProgress); // background sync
    } catch (e: any) { 
      alert('Error updating reviewer: ' + e.message); 
      getProgress(activeSemesterId).then(setProgress); // revert on error
    }
  };

  const handleAddSemester = async () => {
    if (!newSemesterName.trim()) return;
    try {
      await addSemester(newSemesterName.trim());
      const sems = await listSemesters();
      setSemesters(sems);
      setNewSemesterName('');
      if (!activeSemesterId && sems[0]) setActiveSemesterId(sems[0].id);
    } catch (e: any) { alert('Error adding semester: ' + e.message); }
  };

  const handleDeleteSemester = async (id: string) => {
    if (!confirm('Delete this tahun ajaran? This will not delete teams, but will orphan them.')) return;
    try {
      await deleteSemester(id);
      setSemesters(semesters.filter((s) => s.id !== id));
      if (activeSemesterId === id) setActiveSemesterId('');
    } catch (e: any) { alert('Error deleting semester: ' + e.message); }
  };

  const handleSetActiveSemester = async (id: string) => {
    const previousActive = activeSemesterId;
    const previousSemesters = [...semesters];
    setSemesters(semesters.map((s) => ({ ...s, is_active: s.id === id })));
    setActiveSemesterId(id);
    try {
      await setActiveSemester(id);
    } catch (e: any) {
      alert('Error setting active semester: ' + e.message);
      setSemesters(previousSemesters);
      setActiveSemesterId(previousActive);
    }
  };

  const handleSetActivePeriod = async (semesterId: string, period: 'ATS' | 'AAS') => {
    const previousSemesters = [...semesters];
    setSemesters(semesters.map((s) => (s.id === semesterId ? { ...s, active_period: period } : s)));
    try {
      await setActivePeriod(semesterId, period);
      getProgress(semesterId).then(setProgress);
    } catch (e: any) { 
      alert('Error setting active period: ' + e.message); 
      setSemesters(previousSemesters);
    }
  };

  const handleCreateLecturer = async () => {
    try {
      await createLecturerAccount(newLecturerName, newLecturerUsername, newLecturerPassword);
      setLecturers(await listLecturerAccounts());
      setNewLecturerName(''); setNewLecturerUsername(''); setNewLecturerPassword('');
    } catch (e: any) { alert('Error creating lecturer: ' + e.message); }
  };

  const handleDeleteLecturer = async (l: LecturerAccount) => {
    try {
      const gradeCount = await getLecturerGradeCount(l.id);
      const warning = gradeCount > 0
        ? `${l.name} has submitted ${gradeCount} grade(s). Deleting this account will permanently delete those grades too. Continue?`
        : `Delete lecturer "${l.name}"? This cannot be undone.`;
      if (!confirm(warning)) return;
      await deleteLecturerAccount(l.id);
      setLecturers(await listLecturerAccounts());
    } catch (e: any) { alert('Error deleting lecturer: ' + e.message); }
  };

  const handleUnlock = async (teamId: string, lecturerId: string) => {
    if (!confirm('Unlock this reviewer\'s scores for this team?')) return;
    
    // Optimistic update
    setProgress(prev => prev.map(p => {
      if (p.team_id !== teamId) return p;
      return {
        ...p,
        reviewers: p.reviewers.map(r => r.lecturer_id === lecturerId ? { ...r, status: 'Unlocked' } : r)
      };
    }));

    try {
      await unlockTeamReviewer(teamId, lecturerId, activeSemesterId);
      // Background sync
      getProgress(activeSemesterId).then(setProgress);
    } catch (e: any) { 
      alert('Error: ' + e.message); 
      getProgress(activeSemesterId).then(setProgress);
    }
  };

  const handleDeleteTeam = async (team: TeamProgress) => {
    if (!confirm(`Delete team "${team.team_name}" (${team.team_code})?\n\nIf the team has no grades, it will be permanently deleted. If it already has grades, it will be soft-deleted (hidden but preserved). Continue?`)) return;
    
    // Optimistic update
    setProgress(prev => prev.filter(p => p.team_id !== team.team_id));
    setTotalTeams(prev => prev - 1);

    try {
      await deleteTeam(team.team_id);
      // Background sync
      getTeamCount(activeSemesterId).then(setTotalTeams);
      getProgress(activeSemesterId).then(setProgress);
    } catch (e: any) { 
      alert('Error deleting team: ' + e.message); 
      // Revert on error
      getTeamCount(activeSemesterId).then(setTotalTeams);
      getProgress(activeSemesterId).then(setProgress);
    }
  };

  const downloadTeamsTemplate = () => {
    const rows = [{ 'TAHUN AJARAN': 'Genap 2025/2026', 'KODE': 'PBL-RE-001', 'JUDUL PROJECT': 'KRAI', 'PIMPRO': 'Rifqi Amalya Fatekha', 'PRODI': 'D4 Rekayasa Keamanan Siber', 'SEMESTER': 6, 'NIM': '4222301008', 'NAMA': 'Josua Hottua Harianja', 'KELAS': 'IF-1 A Pagi' }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'teams');
    XLSX.writeFile(wb, 'import_template_teams.xlsx');
  };

  const downloadReviewersTemplate = () => {
    const rows = [{ 'TAHUN AJARAN': 'Genap 2025/2026', 'KODE': 'PBL-RE-001', 'JUDUL PROJECT': 'KRAI', 'REVIEWER 1': 'budi.s', 'REVIEWER 2': 'Eko Rudiawan', 'REVIEWER 3': '' }];
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'reviewers');
    XLSX.writeFile(wb, 'import_template_reviewers.xlsx');
  };

  const exportGrades = async () => {
    if (!activeSemesterId) return alert('Select an active tahun ajaran first');
    setIsExporting(true);
    try {
      const rows = await exportGradesData(activeSemesterId);
      if (rows.length === 0) return alert('No data found for this tahun ajaran');
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Grades');
      XLSX.writeFile(wb, 'PBL_Grades_Export.xlsx');
    } catch (err: any) {
      alert('Error exporting grades: ' + err.message);
    } finally { setIsExporting(false); }
  };

  const handleTeamsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSemesterId) return;
    setIsImportingTeams(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        const result = await importTeamsTemplate(json as any, activeSemesterId);
        if (result.success) {
          alert(`Import complete: ${result.teamsProcessed} teams, ${result.studentsProcessed} student rows.`);
          setTotalTeams(await getTeamCount(activeSemesterId));
          setProgress(await getProgress(activeSemesterId));
        } else {
          alert('Import failed:\n' + result.error);
        }
      } catch (err: any) {
        alert('Import failed:\n' + err.message);
      } finally {
        setIsImportingTeams(false);
        if (teamsFileRef.current) teamsFileRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleReviewersFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSemesterId) return;
    setIsImportingReviewers(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        // Use the 'reviewers' sheet if present, else first sheet.
        const sheetName = workbook.SheetNames.includes('reviewers') ? 'reviewers' : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet);
        const result = await importReviewersTemplate(json as any, activeSemesterId);
        if (result.success) {
          alert(`Import complete: ${result.assignmentsApplied} reviewer assignments applied (${result.rowsProcessed} rows read).`);
          setProgress(await getProgress(activeSemesterId));
        } else {
          alert('Import failed:\n' + result.error);
        }
      } catch (err: any) {
        alert('Import failed:\n' + err.message);
      } finally {
        setIsImportingReviewers(false);
        if (reviewersFileRef.current) reviewersFileRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="min-h-screen p-8 max-w-7xl mx-auto space-y-8">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-navy dark:text-sky-light">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage tahun ajaran, teams, lecturer accounts, and track review progress.</p>
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

      {/* Semester Management */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-orange/10 rounded-lg text-orange"><BookOpen size={24} /></div>
          <h2 className="text-xl font-semibold">Tahun Ajaran Management</h2>
        </div>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Available Tahun Ajaran</h3>
            <div className="space-y-2">
              {semesters.map((sem) => (
                <div key={sem.id} className={`flex items-center justify-between p-3 rounded-lg border ${sem.is_active ? 'border-sky bg-sky/5' : 'border-gray-200 dark:border-gray-700'}`}>
                  <div className="flex items-center gap-3">
                    <button onClick={() => handleSetActiveSemester(sem.id)} className={`w-5 h-5 rounded-full border flex items-center justify-center ${sem.is_active ? 'border-sky bg-sky text-white' : 'border-gray-300'}`}>
                      {sem.is_active && <CheckCircle size={14} />}
                    </button>
                    <span className={`font-medium ${sem.is_active ? 'text-sky' : 'text-gray-700 dark:text-gray-300'}`}>{sem.name}</span>
                    {sem.is_active && <span className="text-xs bg-sky/20 text-sky px-2 py-0.5 rounded-full">Active</span>}
                    {sem.is_active && (
                      <div className="flex items-center gap-1 ml-2 border border-gray-200 dark:border-gray-600 rounded-full p-0.5">
                        {(['ATS', 'AAS'] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => handleSetActivePeriod(sem.id, p)}
                            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                              sem.active_period === p ? 'bg-orange text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => handleDeleteSemester(sem.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                </div>
              ))}
              {semesters.length === 0 && <p className="text-sm text-gray-500 italic">No tahun ajaran created yet.</p>}
            </div>
          </div>
          <div className="md:w-1/3 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-700 md:pl-8 pt-4 md:pt-0">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Add New Tahun Ajaran</h3>
            <div className="flex gap-2">
              <input type="text" value={newSemesterName} onChange={(e) => setNewSemesterName(e.target.value)} placeholder="e.g. Ganjil 2026/2027" className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
              <button onClick={handleAddSemester} className="bg-navy hover:bg-navy-light text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-1"><Plus size={16} /> Add</button>
            </div>
          </div>
        </div>
      </section>

      {/* Lecturer accounts */}
      <section className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-green-500/10 rounded-lg text-green-600"><UserPlus size={24} /></div>
          <h2 className="text-xl font-semibold">Lecturer Accounts</h2>
        </div>
        <div className="flex flex-col md:flex-row gap-8">
          <div className="flex-1 space-y-2 max-h-64 overflow-y-auto">
            {lecturers.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{l.name}</span>
                  <span className="text-xs text-gray-500 ml-2">{l.username || '(no username set)'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setEditingLecturer(l)} className="text-xs text-sky hover:underline flex items-center gap-1"><Pencil size={12} /> Edit</button>
                  <button onClick={() => handleDeleteLecturer(l)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 size={12} /> Delete</button>
                </div>
              </div>
            ))}
            {lecturers.length === 0 && <p className="text-sm text-gray-500 italic">No lecturer accounts yet.</p>}
          </div>
          <div className="md:w-1/3 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-700 md:pl-8 pt-4 md:pt-0 space-y-2">
            <h3 className="text-sm font-medium text-gray-500 mb-1">Create Lecturer Account</h3>
            <input value={newLecturerName} onChange={(e) => setNewLecturerName(e.target.value)} placeholder="Full name" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
            <input value={newLecturerUsername} onChange={(e) => setNewLecturerUsername(e.target.value)} placeholder="Username" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
            <input type="password" value={newLecturerPassword} onChange={(e) => setNewLecturerPassword(e.target.value)} placeholder="Password (min 6 chars)" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
            <button onClick={handleCreateLecturer} className="w-full bg-navy hover:bg-navy-light text-white px-3 py-2 rounded-lg text-sm font-medium">Create</button>
          </div>
        </div>
      </section>

      {editingLecturer && (
        <LecturerEditModal
          lecturer={editingLecturer}
          onClose={() => setEditingLecturer(null)}
          onSaved={async () => { setLecturers(await listLecturerAccounts()); setEditingLecturer(null); }}
        />
      )}

      {editingTeam && (
        <TeamEditModal
          team={editingTeam}
          onClose={() => setEditingTeam(null)}
          onSaved={async () => {
            if (activeSemesterId) {
              setProgress(await getProgress(activeSemesterId));
              setTotalTeams(await getTeamCount(activeSemesterId));
            }
          }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Templates & Import */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="p-3 bg-sky/10 rounded-lg text-sky"><Upload size={24} /></div>
            <h2 className="text-xl font-semibold">Import & Templates</h2>
          </div>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">1. Teams + Students + Pimpro</p>
              <div className="flex gap-3 mb-2">
                <button onClick={downloadTeamsTemplate} className="text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2"><Download size={16} /> Template</button>
              </div>
              <label className={`cursor-pointer ${isImportingTeams ? 'bg-gray-400' : 'bg-navy hover:bg-navy-light'} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2`}>
                {isImportingTeams ? <><Loader2 size={16} className="animate-spin" /> Importing...</> : 'Upload Teams File'}
                <input ref={teamsFileRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleTeamsFileUpload} disabled={isImportingTeams || !activeSemesterId} />
              </label>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">2. Reviewer Assignments</p>
              <div className="flex gap-3 mb-2">
                <button onClick={downloadReviewersTemplate} className="text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg flex items-center gap-2"><Download size={16} /> Template</button>
              </div>
              <label className={`cursor-pointer ${isImportingReviewers ? 'bg-gray-400' : 'bg-navy hover:bg-navy-light'} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-2`}>
                {isImportingReviewers ? <><Loader2 size={16} className="animate-spin" /> Importing...</> : 'Upload Reviewers File'}
                <input ref={reviewersFileRef} type="file" accept=".xlsx, .xls" className="hidden" onChange={handleReviewersFileUpload} disabled={isImportingReviewers || !activeSemesterId} />
              </label>
            </div>
            {!activeSemesterId && <p className="text-xs text-red-500">Please set an active tahun ajaran first.</p>}
          </div>
        </div>

        {/* Stats & Export */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg text-green-600"><Users size={24} /></div>
              <h2 className="text-xl font-semibold">Active Tahun Ajaran Stats</h2>
            </div>
            <p className="text-4xl font-bold mb-1">{totalTeams}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Teams for {semesters.find((s) => s.id === activeSemesterId)?.name || '...'}</p>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Export Data</h3>
            <button onClick={exportGrades} disabled={isExporting || !activeSemesterId} className="w-full bg-sky hover:bg-sky-dark disabled:bg-gray-400 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Export Grades Report
            </button>
          </div>
        </div>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <h2 className="text-xl font-semibold">Reviewer Grading Progress</h2>
          <div className="flex items-center gap-4">
            <select
              value={kelasFilter}
              onChange={(e) => setKelasFilter(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1.5 text-sm dark:bg-gray-700"
            >
              <option value="Semua">Semua Kelas</option>
              <option value="Pagi">Kelas Pagi</option>
              <option value="Malam">Kelas Malam</option>
            </select>
            {activeSemesterId && (
              <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full whitespace-nowrap">
                Showing: {semesters.find((s) => s.id === activeSemesterId)?.name} — {semesters.find((s) => s.id === activeSemesterId)?.active_period}
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="p-4 font-medium text-sm text-gray-500 dark:text-gray-400">Team</th>
                <th className="p-4 font-medium text-sm text-gray-500 dark:text-gray-400">Pimpro</th>
                <th className="p-4 font-medium text-sm text-gray-500 dark:text-gray-400">Reviewer</th>
                <th className="p-4 font-medium text-sm text-gray-500 dark:text-gray-400">Students Graded</th>
                <th className="p-4 font-medium text-sm text-gray-500 dark:text-gray-400">Status</th>
                <th className="p-4 font-medium text-sm text-gray-500 dark:text-gray-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500"><Loader2 size={24} className="animate-spin mx-auto text-sky" /></td></tr>
              ) : progress.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">No data available for this tahun ajaran. Import teams and reviewer assignments first.</td></tr>
              ) : (
                progress
                  .filter((p) => {
                    if (kelasFilter === 'Semua') return true;
                    if (kelasFilter === 'Pagi') return p.team_kelas?.toLowerCase().includes('pagi');
                    if (kelasFilter === 'Malam') return p.team_kelas?.toLowerCase().includes('malam');
                    return true;
                  })
                  .map((p) => {
                  // Fixed 3 slots: fill with actual reviewers first, pad the rest with empty slots.
                  const slots = [0, 1, 2].map((i) => p.reviewers[i] ?? null);
                  return (
                    <tr key={p.team_id} className="border-t border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750">
                      <td className="p-4">
                        <div className="font-medium">{p.team_name}</div>
                        <div className="text-xs text-gray-500">{p.team_code}</div>
                      </td>
                      <td className="p-4">
                        <select
                          value={p.pimpro_id || ''}
                          onChange={(e) => handlePimproChange(p.team_id, e.target.value)}
                          className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm dark:bg-gray-700"
                        >
                          <option value="">— none —</option>
                          {lecturerOptions.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </td>
                      <td className="p-4 space-y-1">
                        {slots.map((slot, i) => {
                          const otherIds = new Set(slots.filter((_, j) => j !== i).map((s) => s?.lecturer_id).filter(Boolean));
                          return (
                            <select
                              key={i}
                              value={slot?.lecturer_id || ''}
                              onChange={(e) => handleReviewerChange(p.team_id, slot?.lecturer_id ?? null, e.target.value)}
                              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1 text-sm dark:bg-gray-700"
                            >
                              <option value="">— reviewer {i + 1}: none —</option>
                              {lecturerOptions.filter((l) => !otherIds.has(l.id)).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                          );
                        })}
                      </td>
                      <td className="p-4">
                        {p.reviewers.length === 0 ? (
                          <span className="text-sm text-gray-500">—</span>
                        ) : (
                          <div className="space-y-1">
                            {p.reviewers.map((r) => (
                              <div key={r.lecturer_id} className="flex items-center gap-2">
                                <span className="text-sm font-medium">{r.finalized_students} / {p.total_students}</span>
                                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className="h-full bg-sky" style={{ width: `${p.total_students > 0 ? (r.finalized_students / p.total_students) * 100 : 0}%` }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {p.reviewers.length === 0 ? (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">No Reviewer</span>
                        ) : (
                          <div className="space-y-1">
                            {p.reviewers.map((r) => (
                              <span key={r.lecturer_id} className={`block px-3 py-1 rounded-full text-xs font-medium w-fit ${
                                r.status === 'Completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                r.status === 'In Progress' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                              }`}>{r.lecturer_name}: {r.status}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-4 space-y-2">
                        <div className="space-y-1">
                          {p.reviewers.map((r) => (
                            <button key={r.lecturer_id} onClick={() => handleUnlock(p.team_id, r.lecturer_id)} className="text-xs text-orange-600 hover:underline flex items-center gap-1">
                              <Unlock size={14} /> Unlock {r.lecturer_name}
                            </button>
                          ))}
                        </div>
                        <div className={`flex gap-3 ${p.reviewers.length > 0 ? 'pt-2 border-t border-gray-100 dark:border-gray-700' : ''}`}>
                          <button onClick={() => setEditingTeam(p)} className="text-xs text-sky hover:underline flex items-center gap-1"><Pencil size={14} /> Edit</button>
                          <button onClick={() => handleDeleteTeam(p)} className="text-xs text-red-500 hover:underline flex items-center gap-1"><Trash2 size={14} /> Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// Edit modal for a lecturer account: name, username, optional password reset (blank = unchanged).
function LecturerEditModal({
  lecturer, onClose, onSaved,
}: { lecturer: LecturerAccount; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(lecturer.name);
  const [username, setUsername] = useState(lecturer.username || '');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setPending(true);
    try {
      await updateLecturerAccount(lecturer.id, { name, username, newPassword: password || undefined });
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-sm w-full space-y-3">
        <h3 className="text-lg font-semibold">Edit Lecturer</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (leave blank to keep unchanged)" className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={pending} className="flex-1 bg-navy hover:bg-navy-light text-white rounded-lg py-2 text-sm disabled:opacity-50">{pending ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

function TeamEditModal({
  team, onClose, onSaved,
}: { team: TeamProgress; onClose: () => void; onSaved: () => void }) {
  const [students, setStudents] = useState<{ id: string; nim: string; name: string; prodi?: string; semester?: string; kelas?: string; }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [newNim, setNewNim] = useState('');
  const [newName, setNewName] = useState('');
  const [newProdi, setNewProdi] = useState('');
  const [newSemester, setNewSemester] = useState('');
  const [newKelas, setNewKelas] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    getTeamStudents(team.team_id)
      .then(setStudents)
      .catch((e) => setError('Failed to load students: ' + e.message))
      .finally(() => setLoading(false));
  }, [team.team_id]);

  const handleUpdateStudent = async (studentId: string, nim: string, name: string, prodi: string, smt: string, kelas: string) => {
    try {
      await updateStudent(studentId, nim, name, prodi, smt, kelas);
      setStudents(students.map(s => s.id === studentId ? { ...s, nim, name, prodi, smt, kelas } : s));
      onSaved();
    } catch (e: any) { alert(e.message); }
  };

  const handleAddStudent = async () => {
    if (!newNim.trim() || !newName.trim()) return alert('NIM and Name required');
    setAdding(true);
    try {
      await addStudentToTeam(team.team_id, newNim, newName, newProdi, newSemester, newKelas);
      setStudents(await getTeamStudents(team.team_id));
      setNewNim('');
      setNewName('');
      setNewProdi('');
      setNewSemester('');
      setNewKelas('');
      onSaved();
    } catch (e: any) { alert(e.message); }
    finally { setAdding(false); }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm('Remove this student from the team?')) return;
    try {
      await removeStudentFromTeam(team.team_id, studentId);
      setStudents(students.filter(s => s.id !== studentId));
      onSaved();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-4xl w-full flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold">Edit Team: {team.team_name}</h3>
            <p className="text-sm text-gray-500">{team.team_code}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold p-2">&times;</button>
        </div>
        
        {error && <p className="text-sm text-red-500 mb-4 flex-shrink-0">{error}</p>}
        
        <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 min-h-0">
          {loading ? (
            <div className="py-4 text-center"><Loader2 className="animate-spin mx-auto text-sky" /></div>
          ) : students.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No students in this team.</p>
          ) : (
            students.map(s => (
              <div key={s.id} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2 items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <input 
                  defaultValue={s.nim} 
                  onBlur={(e) => { if (e.target.value !== s.nim) handleUpdateStudent(s.id, e.target.value, s.name, s.prodi || '', s.semester || '', s.kelas || '') }}
                  className="md:col-span-2 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700" 
                  placeholder="NIM" 
                />
                <input 
                  defaultValue={s.name} 
                  onBlur={(e) => { if (e.target.value !== s.name) handleUpdateStudent(s.id, s.nim, e.target.value, s.prodi || '', s.semester || '', s.kelas || '') }}
                  className="md:col-span-3 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700" 
                  placeholder="Name" 
                />
                <input 
                  defaultValue={s.prodi || ''} 
                  onBlur={(e) => { if (e.target.value !== (s.prodi || '')) handleUpdateStudent(s.id, s.nim, s.name, e.target.value, s.semester || '', s.kelas || '') }}
                  className="md:col-span-3 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700" 
                  placeholder="Prodi" 
                />
                <input 
                  defaultValue={s.semester || ''} 
                  onBlur={(e) => { if (e.target.value !== (s.semester || '')) handleUpdateStudent(s.id, s.nim, s.name, s.prodi || '', e.target.value, s.kelas || '') }}
                  className="md:col-span-1 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700" 
                  placeholder="Semester" 
                />
                <div className="md:col-span-3 flex gap-2 w-full">
                  <input 
                    defaultValue={s.kelas || ''} 
                    onBlur={(e) => { if (e.target.value !== (s.kelas || '')) handleUpdateStudent(s.id, s.nim, s.name, s.prodi || '', s.semester || '', e.target.value) }}
                    className="flex-1 w-full border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm dark:bg-gray-700" 
                    placeholder="Kelas" 
                  />
                  <button onClick={() => handleRemoveStudent(s.id)} className="text-red-500 hover:text-red-700 p-1 flex-shrink-0" title="Remove student">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-700 pt-4 mt-auto flex-shrink-0">
          <h4 className="text-sm font-medium mb-2">Add New Student</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2">
            <input 
              value={newNim} onChange={e => setNewNim(e.target.value)}
              className="md:col-span-2 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700" 
              placeholder="NIM" 
            />
            <input 
              value={newName} onChange={e => setNewName(e.target.value)}
              className="md:col-span-3 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700" 
              placeholder="Name" 
            />
            <input 
              value={newProdi} onChange={e => setNewProdi(e.target.value)}
              className="md:col-span-3 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700" 
              placeholder="Prodi" 
            />
            <input 
              value={newSemester} onChange={e => setNewSemester(e.target.value)}
              className="md:col-span-1 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700" 
              placeholder="Semester" 
            />
            <div className="md:col-span-3 flex gap-2 w-full">
              <input 
                value={newKelas} onChange={e => setNewKelas(e.target.value)}
                className="flex-1 w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm dark:bg-gray-700" 
                placeholder="Kelas" 
              />
              <button 
                onClick={handleAddStudent} disabled={adding}
                className="bg-sky hover:bg-sky-dark text-white rounded px-4 py-2 text-sm font-medium disabled:opacity-50 flex-shrink-0"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
