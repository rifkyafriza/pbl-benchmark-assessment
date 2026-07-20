'use client';
import { useState } from 'react';
import { loginAdmin } from '@/lib/auth';
import { Lock } from 'lucide-react';

export default function AdminLoginPage() {
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function action(formData: FormData) {
    setPending(true);
    setError('');
    const res = await loginAdmin(formData);
    if (res?.error) setError(res.error);
    setPending(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center p-4">
      <form action={action} className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 max-w-md w-full space-y-4">
        <div className="flex justify-center mb-2 text-navy dark:text-sky-light"><Lock size={40} /></div>
        <h1 className="text-2xl font-bold text-center mb-4 text-navy dark:text-sky-light">Admin Login</h1>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
          <input name="username" required autoFocus className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-3 outline-none focus:border-sky bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
          <input name="password" type="password" required className="w-full border border-gray-200 dark:border-gray-600 rounded-lg p-3 outline-none focus:border-sky bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100" />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button disabled={pending} type="submit" className="w-full bg-navy hover:bg-navy-light text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors">
          {pending ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
