'use client';
import { useState } from 'react';
import { changeOwnPassword } from '@/lib/auth';
import { KeyRound } from 'lucide-react';
import { useToast } from '@/components/Toast';

// Self-service password change, used on both admin and lecturer dashboards.
export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const submit = async () => {
    setError('');
    if (next !== confirm) return setError('New passwords do not match.');
    setPending(true);
    try {
      await changeOwnPassword(current, next);
      toast.success('Password changed successfully.');
      setOpen(false);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e: any) {
      toast.error(e.message);
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-gray-500 dark:text-gray-400 hover:text-sky dark:hover:text-sky-light flex items-center gap-1 text-sm font-medium">
        <KeyRound size={16} /> Change Password
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-panel antigravity-shadow p-6 rounded-xl max-w-sm w-full space-y-3 animate-fade-in-up">
        <h3 className="text-lg font-semibold">Change Password</h3>
        <input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:border-sky outline-none shadow-inner" />
        <input type="password" placeholder="New password (min 6 chars)" value={next} onChange={(e) => setNext(e.target.value)} className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:border-sky outline-none shadow-inner" />
        <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full glass-panel rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:border-sky outline-none shadow-inner" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={() => setOpen(false)} className="flex-1 glass-panel rounded-lg py-2 text-sm hover:text-sky transition-colors">Cancel</button>
          <button onClick={submit} disabled={pending} className="flex-1 bg-navy hover:bg-navy-light text-white rounded-lg py-2 text-sm disabled:opacity-50 transition-all active:scale-95 antigravity-shadow">{pending ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
