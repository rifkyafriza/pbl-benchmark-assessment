'use client';
import { useState } from 'react';
import { changeOwnPassword } from '@/lib/auth';
import { KeyRound } from 'lucide-react';

// Self-service password change, used on both admin and lecturer dashboards.
export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (next !== confirm) return setError('New passwords do not match.');
    setPending(true);
    try {
      await changeOwnPassword(current, next);
      alert('Password changed successfully.');
      setOpen(false);
      setCurrent(''); setNext(''); setConfirm('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-gray-500 hover:text-sky flex items-center gap-1 text-sm font-medium">
        <KeyRound size={16} /> Change Password
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg max-w-sm w-full space-y-3">
        <h3 className="text-lg font-semibold">Change Password</h3>
        <input type="password" placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
        <input type="password" placeholder="New password (min 6 chars)" value={next} onChange={(e) => setNext(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
        <input type="password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm dark:bg-gray-700" />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button onClick={() => setOpen(false)} className="flex-1 border border-gray-300 dark:border-gray-600 rounded-lg py-2 text-sm">Cancel</button>
          <button onClick={submit} disabled={pending} className="flex-1 bg-navy hover:bg-navy-light text-white rounded-lg py-2 text-sm disabled:opacity-50">{pending ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
