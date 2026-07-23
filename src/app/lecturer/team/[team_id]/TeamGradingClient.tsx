'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';
import { saveGrades } from '@/lib/lecturerActions';
import { useToast } from '@/components/Toast';

type Student = { id: string; name: string; nim: string; kelas?: string | null };
type GradeEntry = { implementation_score: number; document_score: number; english_score: number; comment: string };

function ensureAbsoluteUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed === '' || trimmed === '-' || trimmed.toLowerCase() === 'n/a') return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

type ScoreKey = 'implementation_score' | 'document_score' | 'english_score';

const SCORE_CRITERIA: { key: ScoreKey; label: string; description: string; rubricLevels: string[] }[] = [
  { 
    key: 'implementation_score', 
    label: 'b7. Implementation', 
    description: 'Solves the problem statement comprehensively.',
    rubricLevels: [
      'Cannot design the implementation process. Unable to perform manufacturing properly. Unable to perform integration properly. Unable to perform test, verification, and validation. Unable to perform implementation management.',
      'Recognize the implementation system design. Not completely perform manufacturing. Not completely perform integration. Not completely perform test, verification, and validation. Not completely perform implementation management.',
      'Understand the implementation system design. Generally perform manufacturing. Generally perform integration. Generally perform test, verification, and validation. Generally perform implementation management.',
      'Can executed the implementation system design. Completely perform manufacturing. Completely perform integration. Completely perform test, verification, and validation. Completely perform implementation management.',
      'Properly and completely executed implementation system design. Properly and completely perform manufacturing. Properly and completely perform integration. Properly and completely perform test, verification, and validation. Properly and completely perform implementation management.'
    ]
  },
  { 
    key: 'document_score', 
    label: 'c1. Written Document', 
    description: 'Well-structured, clear, follows formatting guidelines.',
    rubricLevels: [
      'The written work is confusing and ambiguous owing to substantial errors in grammar and syntax. Written work has serious and persistent errors in word selection and terminology.',
      'The written work contains some grammatical and syntax errors. Written work has several major errors in word selection and terminology.',
      'The written work may exhibit a few minor errors in grammar or style. Written work has little major of errors in word selection and terminology.',
      'The written work contains sentences that are almost always complete and grammatically correct. Written work is relatively free of errors in word selection and terminology.',
      'The written work contains sentences that are always complete and grammatically correct. Written work has no major errors in word selection and terminology.'
    ]
  },
  { 
    key: 'english_score', 
    label: 'c7. Communication in English', 
    description: 'Ability to communicate effectively.',
    rubricLevels: [
      'Difficult to understand and had a hard time communicating their ideas. Difficult to understand, quiet in speaking, unclear in pronunciation. Speech is very slow, stumbling, nervous, and uncertain.',
      'Adequately understand but still have difficulty to communicate their ideas. Slightly unclear with pronunciation at times. Speech is slow and often hesitant and irregular. Sentences may be left uncompleted.',
      'Able to express their ideas adequately but often displayed inconsistencies. Pronunciation was good but sometimes interfere with communication. Speech is mostly smooth but with some hesitation.',
      'Able to express their ideas fairly well but makes mistakes with their tenses, however is able to correct themselves. Pronunciation was very good. Speech is smooth without hesitation.',
      'Able to express their ideas with ease in proper sentence structure and tenses. Pronunciation was very clear and easy to understand. Speech is effortless and smooth.'
    ]
  },
];

const TEAM_LINKS = [
  { key: 'rpp', label: 'RPP' },
  { key: 'laporan_akhir', label: 'Laporan Akhir' },
  { key: 'poster', label: 'Poster' },
  { key: 'manual_book', label: 'Manual Book' },
  { key: 'bast', label: 'BAST' },
  { key: 'video_demo', label: 'Video Demo' },
];

function ScoreStepper({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="flex gap-1.5 shrink-0">
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center active:scale-95 ${
            value === n ? 'bg-sky text-white shadow-[0_0_15px_rgba(77,188,214,0.4)]' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
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
  const toast = useToast();
  const [grades, setGrades] = useState<Record<string, GradeEntry>>(initialGrades);
  
  const initialTeamComment = Object.values(initialGrades)[0]?.comment || '';
  const [teamComment, setTeamComment] = useState(initialTeamComment);
  
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
    setGrades((prev) => ({ 
      ...prev, 
      [studentId]: { 
        ...(prev[studentId] || { implementation_score: 0, document_score: 0, english_score: 0, comment: teamComment }), 
        [field]: value 
      } 
    }));
  };

  const handleSave = async (finalize: boolean) => {
    setSaving(true);
    setError('');
    try {
      const entries = students.map((s) => ({
        studentId: s.id,
        implementation_score: grades[s.id]?.implementation_score || 0,
        document_score: grades[s.id]?.document_score || 0,
        english_score: grades[s.id]?.english_score || 0,
        comment: teamComment,
      }));
      await saveGrades(team.id, entries, finalize);
      toast.success(finalize ? 'Grades finalized and locked!' : 'Draft saved successfully!');
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
    <div className="min-h-screen pb-28 relative">
      {/* Ambient Background Orbs */}
      <div className="fixed top-0 left-1/4 w-[800px] h-[800px] bg-sky/5 dark:bg-sky/10 rounded-full blur-[100px] -z-10 pointer-events-none translate-x-[-50%]"></div>
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-orange/5 dark:bg-orange/10 rounded-full blur-[80px] -z-10 pointer-events-none translate-x-[50%]"></div>
      <header className="glass-panel sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link prefetch={true} href="/lecturer/dashboard" className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="font-bold text-navy dark:text-white text-lg leading-tight">{team?.name}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{team?.team_code}{period ? ` · ${period}` : ''}</p>
              </div>
            </div>
            {locked && <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-medium shadow-sm">Locked</span>}
          </div>
          
          <div className="flex flex-wrap gap-2 ml-10">
            {TEAM_LINKS.map(link => {
              const url = ensureAbsoluteUrl(team[link.key]);
              return url ? (
                <a key={link.key} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-100 dark:border-blue-900/50">
                  {link.label} <ExternalLink size={12} />
                </a>
              ) : null;
            })}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 mt-4">
        {locked && (
          <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300 text-sm p-4 rounded-xl font-medium shadow-sm">
            Your scores for this team are locked. Ask the admin to unlock if you need to make corrections.
          </div>
        )}
        {error && <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm p-4 rounded-xl">{error}</div>}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Filter Students ({filteredStudents.length})</h2>
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl">
            {['Semua', 'Pagi', 'Malam'].map((k) => (
              <button
                key={k}
                onClick={() => setKelasFilter(k)}
                className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${
                  kelasFilter === k ? 'bg-white dark:bg-gray-700 text-sky shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {SCORE_CRITERIA.map(criterion => (
          <details key={criterion.key} className="group/category bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700" open>
            <summary className="p-5 flex items-center justify-between cursor-pointer list-none appearance-none border-b border-transparent group-open/category:border-gray-100 dark:group-open/category:border-gray-700 transition-colors">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{criterion.label}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{criterion.description}</p>
              </div>
              <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full group-open/category:rotate-180 transition-transform shrink-0 ml-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
            </summary>
            
            <div className="p-5 pt-4 space-y-4">
              <div className="mb-2">
                <details className="group/rubric">
                  <summary className="flex items-center gap-2 cursor-pointer list-none appearance-none text-sky text-sm font-bold w-max hover:opacity-80 transition-opacity">
                    <svg className="group-open/rubric:rotate-90 transition-transform" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    View Rubric Matrix
                  </summary>
                
                  {criterion.rubricLevels && (
                    <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                      <table className="w-full text-left border-collapse text-xs min-w-[600px]">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-900/80">
                            <th className="p-2.5 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 w-1/5 border-r last:border-r-0">1 - Poor</th>
                            <th className="p-2.5 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 w-1/5 border-r last:border-r-0">2 - Fair</th>
                            <th className="p-2.5 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 w-1/5 border-r last:border-r-0">3 - Good</th>
                            <th className="p-2.5 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 w-1/5 border-r last:border-r-0">4 - Very Good</th>
                            <th className="p-2.5 border-b border-gray-200 dark:border-gray-700 font-semibold text-gray-700 dark:text-gray-300 w-1/5 border-r last:border-r-0">5 - Excellent</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            {criterion.rubricLevels.map((level, i) => (
                              <td key={i} className="p-2.5 border-r border-gray-200 dark:border-gray-700 last:border-r-0 text-gray-600 dark:text-gray-400 align-top leading-relaxed">
                                {level}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </details>
              </div>
              
              <div className="space-y-4 pt-2 divide-y divide-gray-50 dark:divide-gray-700/50">
                {filteredStudents.map(student => {
                   const currentScore = grades[student.id]?.[criterion.key] || 0;
                   return (
                     <div key={student.id} className="pt-4 first:pt-2 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                       <div>
                          <h3 className="font-bold text-gray-900 dark:text-gray-100">{student.name}</h3>
                          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{student.nim} {student.kelas ? `· ${student.kelas}` : ''}</p>
                       </div>
                       <div className="flex items-center gap-3">
                          <ScoreStepper value={currentScore} onChange={(v) => update(student.id, criterion.key, v)} disabled={locked} />
                          <span className="w-14 text-center font-black text-sky text-sm bg-sky/10 px-2 py-1.5 rounded-lg shrink-0">{currentScore} / 5</span>
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          </details>
        ))}

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Team Feedback Comment</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">This comment will be applied to all students in this team.</p>
          <textarea
            value={teamComment}
            onChange={(e) => setTeamComment(e.target.value)}
            disabled={locked}
            placeholder="Enter qualitative feedback for the entire team..."
            className="w-full border border-gray-200 dark:border-gray-600 rounded-xl p-4 text-sm bg-gray-50 dark:bg-gray-700 focus:border-sky outline-none min-h-[120px] resize-y disabled:opacity-50 text-gray-800 dark:text-gray-200"
          />
        </div>
      </main>

      {!locked && (
        <div className="fixed bottom-0 left-0 right-0 glass-panel border-t p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto flex gap-3">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 py-3.5 font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="flex-1 py-3.5 font-bold text-white bg-navy hover:bg-navy-light rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 size={18} /> Finalize & Lock
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
