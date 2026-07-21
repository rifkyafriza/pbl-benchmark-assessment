'use client';
import { useState } from 'react';
import { loginAdmin } from '@/lib/auth';
import { Lock, Loader2, LogIn } from 'lucide-react';

export default function AdminLoginPage() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');
    const res = await loginAdmin(new FormData(e.currentTarget));
    if (res?.error) setError(res.error);
    setPending(false);
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky/5 dark:bg-sky/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <form onSubmit={handleSubmit} className="glass-panel p-8 rounded-2xl antigravity-shadow max-w-md w-full space-y-4 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex justify-center mb-2 text-navy dark:text-sky-light"><Lock size={40} /></div>
        <h1 className="text-2xl font-bold text-center mb-4 text-navy dark:text-sky-light">Admin Login</h1>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
          <input name="username" required autoFocus className="w-full glass-panel rounded-lg p-3 outline-none focus:border-sky text-gray-800 dark:text-gray-100 transition-colors shadow-inner" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <input name="password" type="password" required className="w-full glass-panel rounded-lg p-3 outline-none focus:border-sky text-gray-800 dark:text-gray-100 transition-colors shadow-inner" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={pending} type="submit" className="w-full bg-navy hover:bg-navy-light text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-95 antigravity-shadow">
          {pending ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Logging in...
            </>
          ) : (
            <>
              <LogIn size={20} /> Login
            </>
          )}
        </button>
      </form>
    </div>
  );
}
