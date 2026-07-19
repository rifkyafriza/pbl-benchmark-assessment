import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-900">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-navy dark:text-sky-light mb-4">Benchmark Assessment</h1>
        <p className="text-gray-600 dark:text-gray-400">Select a portal to continue.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        <Link href="/admin/login" className="block">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700 hover:border-sky text-center group">
            <h2 className="text-2xl font-semibold mb-2 group-hover:text-sky transition-colors">Admin Portal</h2>
            <p className="text-sm text-gray-500">Manage semesters, teams, and track grading progress.</p>
          </div>
        </Link>
        <Link href="/lecturer" className="block">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 dark:border-gray-700 hover:border-orange text-center group">
            <h2 className="text-2xl font-semibold mb-2 group-hover:text-orange transition-colors">Lecturer Portal</h2>
            <p className="text-sm text-gray-500">Grade students and manage benchmark assessments.</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
