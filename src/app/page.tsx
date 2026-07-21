import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-50/50 dark:bg-gray-900/50 relative overflow-hidden">
      {/* Subtle background glow effect (Antigravity style) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky/5 dark:bg-sky/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="text-center mb-16 opacity-0 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-navy dark:text-white mb-2 tracking-tight">Benchmark Assessment</h1>
        <h2 className="text-xl sm:text-2xl font-medium text-sky dark:text-sky-light/80 mb-6">Robotics Engineering Technology</h2>
        <p className="text-gray-600 dark:text-gray-400 max-w-sm mx-auto">Select a portal to access the PBL evaluation and management system.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl px-4 sm:px-0">
        <Link href="/admin/login" className="block opacity-0 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="glass-panel p-8 rounded-2xl antigravity-shadow antigravity-hover text-center group cursor-pointer">
            <div className="w-12 h-12 bg-navy/5 dark:bg-sky/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-navy dark:text-sky-light" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 group-hover:text-sky transition-colors text-gray-900 dark:text-white">Admin Portal</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage semesters, teams, and track grading progress.</p>
          </div>
        </Link>
        <Link href="/lecturer" className="block opacity-0 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="glass-panel p-8 rounded-2xl antigravity-shadow antigravity-hover text-center group cursor-pointer">
            <div className="w-12 h-12 bg-orange/5 dark:bg-orange/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-orange dark:text-orange-light" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 group-hover:text-orange transition-colors text-gray-900 dark:text-white">Lecturer Portal</h2>
            <p className="text-sm text-gray-500">Grade students and manage benchmark assessments.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
