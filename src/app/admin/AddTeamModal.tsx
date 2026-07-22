'use client';
import { useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { addTeamManual } from '@/lib/actions/admin/teamActions';

type Lecturer = {
  id: string;
  name: string;
  initials: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  academicYearId: string;
  lecturers: Lecturer[];
};

export default function AddTeamModal({ isOpen, onClose, onSuccess, academicYearId, lecturers }: Props) {
  const [teamCode, setTeamCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [pimproId, setPimproId] = useState('');
  const [teamKelas, setTeamKelas] = useState('');
  const [students, setStudents] = useState([{ nim: '', name: '' }]);
  const [activeTab, setActiveTab] = useState<'members' | 'documents'>('members');
  const [links, setLinks] = useState({
    rpp: '', laporan_akhir: '', poster: '', manual_book: '', bast: '', video_demo: ''
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddStudent = () => {
    setStudents([...students, { nim: '', name: '' }]);
  };

  const handleRemoveStudent = (index: number) => {
    setStudents(students.filter((_, i) => i !== index));
  };

  const handleStudentChange = (index: number, field: 'nim' | 'name', value: string) => {
    const newStudents = [...students];
    newStudents[index][field] = value;
    setStudents(newStudents);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError('');

    if (!teamCode.trim() || !teamName.trim()) {
      setError('Team Code and Team Name are required.');
      setPending(false);
      return;
    }

    const validStudents = students.filter(s => s.nim.trim() && s.name.trim());
    if (validStudents.length === 0) {
      setError('At least one student is required.');
      setPending(false);
      return;
    }

    try {
      await addTeamManual(
        academicYearId,
        teamCode,
        teamName,
        pimproId || null,
        teamKelas || null,
        validStudents,
        links
      );
      // Reset and close
      setTeamCode('');
      setTeamName('');
      setPimproId('');
      setTeamKelas('');
      setStudents([{ nim: '', name: '' }]);
      setLinks({ rpp: '', laporan_akhir: '', poster: '', manual_book: '', bast: '', video_demo: '' });
      setActiveTab('members');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Add Team Manually</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="px-6 pt-4 border-b border-gray-100 dark:border-gray-700 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'members' ? 'border-b-2 border-sky text-sky' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Team Details & Members
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`pb-2 text-sm font-medium transition-colors ${activeTab === 'documents' ? 'border-b-2 border-sky text-sky' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            Document Links
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {activeTab === 'members' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Code *</label>
              <input
                required
                value={teamCode}
                onChange={(e) => setTeamCode(e.target.value)}
                placeholder="e.g. PBL-RE-000"
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 outline-none focus:border-sky bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Manpro / Pimpro</label>
              <select
                value={pimproId}
                onChange={(e) => setPimproId(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 outline-none focus:border-sky bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              >
                <option value="">-- None --</option>
                {lecturers.map(l => (
                  <option key={l.id} value={l.id}>{l.name} {l.initials ? `(${l.initials})` : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Team Class</label>
              <select
                value={teamKelas}
                onChange={(e) => setTeamKelas(e.target.value)}
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 outline-none focus:border-sky bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              >
                <option value="">-- Select Class --</option>
                <option value="Pagi">Pagi</option>
                <option value="Malam">Malam</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Title (Team Name) *</label>
              <input
                required
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Sistem Informasi Manajamen..."
                className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 outline-none focus:border-sky bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Students</label>
              <button
                type="button"
                onClick={handleAddStudent}
                className="text-sky hover:text-navy text-sm font-medium flex items-center gap-1 transition-colors"
              >
                <Plus size={16} /> Add Student
              </button>
            </div>
            
            <div className="space-y-3">
              {students.map((student, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      placeholder="NIM"
                      value={student.nim}
                      onChange={(e) => handleStudentChange(index, 'nim', e.target.value)}
                      required
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 outline-none focus:border-sky bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    />
                    <input
                      placeholder="Student Name"
                      value={student.name}
                      onChange={(e) => handleStudentChange(index, 'name', e.target.value)}
                      required
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 outline-none focus:border-sky bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                    />
                  </div>
                  {students.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveStudent(index)}
                      className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Remove student"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              {[
                { key: 'rpp', label: 'RPP (URL)', placeholder: 'https://...' },
                { key: 'laporan_akhir', label: 'Laporan Akhir (URL)', placeholder: 'https://...' },
                { key: 'poster', label: 'Poster (URL)', placeholder: 'https://...' },
                { key: 'manual_book', label: 'Manual Book (URL)', placeholder: 'https://...' },
                { key: 'bast', label: 'BAST (URL)', placeholder: 'https://...' },
                { key: 'video_demo', label: 'Video Demo (URL)', placeholder: 'https://youtube.com/...' },
              ].map(doc => (
                <div key={doc.key} className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{doc.label}</label>
                  <input
                    type="url"
                    value={links[doc.key as keyof typeof links]}
                    onChange={(e) => setLinks(prev => ({ ...prev, [doc.key]: e.target.value }))}
                    placeholder={doc.placeholder}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-2.5 outline-none focus:border-sky bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                  />
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 sticky bottom-0 bg-white dark:bg-gray-800 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="px-5 py-2.5 bg-navy hover:bg-navy-light text-white font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {pending ? <><Loader2 size={18} className="animate-spin" /> Saving...</> : 'Save Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
