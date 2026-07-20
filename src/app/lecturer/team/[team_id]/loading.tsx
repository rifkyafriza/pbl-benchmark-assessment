export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
            <div>
              <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1"></div>
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="flex gap-2 ml-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 w-20 bg-blue-100 dark:bg-blue-900/30 rounded-lg animate-pulse"></div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6 mt-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4 animate-pulse">
            <div className="mb-2 space-y-2">
              <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
            <div className="space-y-6 pt-2">
              {[1, 2, 3].map(j => (
                <div key={j} className="pt-4 border-t border-gray-50 dark:border-gray-700/50">
                  <div className="flex justify-between items-center mb-3">
                    <div className="space-y-2">
                      <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="h-11 w-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
