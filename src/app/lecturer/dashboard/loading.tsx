export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-8 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-8 pt-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
        </div>
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
      </header>

      <div className="mb-4 flex justify-between">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
        <div className="h-8 w-32 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
