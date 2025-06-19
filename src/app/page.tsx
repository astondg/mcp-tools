export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8">
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
          MCP Tools Server
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          A collection of useful tools accessible via the Model Context Protocol
        </p>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Available Tools
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                🎲 Roll Dice
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Roll an N-sided die (2-100 sides)
              </p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                🔐 Generate Password
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Create secure random passwords (8-128 chars)
              </p>
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                ⏰ Current Timestamp
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Get current Unix timestamp and formatted date
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            MCP Server Endpoint
          </h3>
          <code className="bg-gray-800 text-green-400 px-4 py-2 rounded font-mono text-sm">
            {typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.vercel.app'}/api/mcp
          </code>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
            Connect this endpoint to your MCP-compatible client (Claude, Cursor, etc.)
          </p>
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <a
            href="https://vercel.com/docs/mcp"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Learn More About MCP
          </a>
          <a
            href="https://github.com/vercel/mcp-adapter"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
