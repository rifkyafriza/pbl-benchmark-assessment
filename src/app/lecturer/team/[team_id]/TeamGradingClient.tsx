'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, CheckCircle2, Loader2 } from 'lucide-react';
import { saveGrades } from '@/lib/lecturerActions';

type Student = { id: string; name: string; nim: string; kelas?: string | null };
type GradeEntry = { implementation_score: number; document_score: number; english_score: number; comment: string };

type ScoreKey = 'implementation_score' | 'document_score' | 'english_score';
const SCORE_LABELS: { key: ScoreKey; label: string }[] = [
  { key: 'implementation_score', label: 'Implementation' },
  { key: 'document_score', label: 'Written Document' },
  { key: 'english_score', label: 'Communication (English)' },
];

// Big-tap-target 0–5 segmented stepper — mobile-first per PRD, no bare number input.
function ScoreStepper({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`h-11 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${
            value === n ? 'bg-sky text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function TeamGradingClient({
  team,
  students,
  initialGrades,
  isLocked,
  period,
}: {
  team: any;
  students: Student[];
  initialGrades: Record<string, GradeEntry>;
  isLocked: boolean;
  period?: 'ATS' | 'AAS';
}) {
  const router = useRouter();
  const [grades, setGrades] = useState<Record<string, GradeEntry>>(initialGrades);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(isLocked);
  const [error, setError] = useState('');
  const [kelasFilter, setKelasFilter] = useState<string>('Semua');

  const filteredStudents = students.filter(s => {
    if (kelasFilter === 'Semua') return true;
    if (kelasFilter === 'Pagi') return s.kelas?.toLowerCase().includes('pagi');
    if (kelasFilter === 'Malam') return s.kelas?.toLowerCase().includes('malam');
    return true;
  });

  const update = <K extends keyof GradeEntry>(studentId: string, field: K, value: GradeEntry[K]) => {
    setGrades((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [field]: value } }));
  };

  const handleSave = async (finalize: boolean) => {
    setSaving(true);
    setError('');
    try {
      const entries = students.map((s) => ({ studentId: s.id, ...grades[s.id] }));
      await saveGrades(team.id, entries, finalize);
      if (finalize) {
        setLocked(true);
        router.push('/lecturer/dashboard');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link prefetch={true} href="/lecturer/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="font-bold text-navy dark:text-white text-lg">{team?.name}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{team?.team_code}{period ? ` · ${period}` : ''}</p>
            </div>
          </div>
          {locked && <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium">Locked</span>}
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6 mt-4">
        {locked && (
          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 text-sm p-4 rounded-xl">
            Your scores for this team are locked. Ask the admin to unlock if you need to make corrections.
          </div>
        )}
        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm p-4 rounded-xl">{error}</div>}

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Students ({filteredStudents.length})</h2>
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {['Semua', 'Pagi', 'Malam'].map((k) => (
              <button
                key={k}
                onClick={() => setKelasFilter(k)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  kelasFilter === k ? 'bg-white dark:bg-gray-700 text-sky shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {filteredStudents.map((student) => {
          const g = grades[student.id];
          return (
            <div key={student.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white">{student.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{student.nim}</p>
              </div>

              {SCORE_LABELS.map(({ key, label }) => (
                <div key={key}>
                  <div className="flex justify-between mb-2">
                    <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
                    <span className="font-bold text-sky">{g[key]} / 5</span>
                  </div>
                  <ScoreStepper value={g[key]} onChange={(v) => update(student.id, key, v)} disabled={locked} />
                </div>
              ))}

              <div>
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 block">Comment (Optional)</label>
                <textarea
                  value={g.comment}
                  onChange={(e) => update(student.id, 'comment', e.target.value)}
                  disabled={locked}
                  placeholder="Enter qualitative feedback..."
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-3 text-sm bg-gray-50 dark:bg-gray-700 focus:border-sky outline-none min-h-[80px] resize-none disabled:opacity-50 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          );
        })}
      </main>

      {!locked && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 p-4">
          <div className="max-w-3xl mx-auto flex gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 py-3 font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 py-3 font-medium text-white bg-navy hover:bg-navy-light rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <CheckCircle2 size={18} /> Finalize & Lock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
