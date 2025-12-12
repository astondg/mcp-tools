export default function McpToolsPage() {
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
          <div className="grid md:grid-cols-1 gap-6 max-w-2xl mx-auto">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                🛒 Get OzBargain Deals
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Fetch and parse the latest deals from OzBargain RSS feed with detailed information including title, description, categories, and thumbnail images
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div><strong>Parameters:</strong></div>
                <div>• limit: Number of deals to return 1-50 (default: 10)</div>
              </div>
              <div className="mt-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-300">
                ✅ Live RSS feed integration with OzBargain.com.au
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                💼 Search Freelancer Projects
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Search for freelance projects with budget filters, keyword matching, and detailed project information including ID, description, location, and skills
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div><strong>Parameters:</strong></div>
                <div>• query: Search keywords (required)</div>
                <div>• minBudget, maxBudget: Budget range filters (optional)</div>
                <div>• projectType: &apos;fixed&apos; or &apos;hourly&apos; (optional)</div>
                <div>• limit: Number of results 1-50 (default: 10)</div>
              </div>
              <div className="mt-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-300">
                ✅ Live API integration with Freelancer.com
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                📋 Get Project Details
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Get comprehensive details about a specific freelancer project including full description, job requirements, location, and all available project metadata
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div><strong>Parameters:</strong></div>
                <div>• projectId: ID of the project (required)</div>
                <div>• fullDescription: Include full description (optional)</div>
                <div>• jobDetails: Include job/skills information (optional)</div>
                <div>• userDetails: Include user information (optional)</div>
                <div>• locationDetails: Include location information (optional)</div>
                <div>• Plus 40+ other optional detail flags</div>
              </div>
              <div className="mt-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-300">
                ✅ Live API integration with Freelancer.com
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                💰 Place Freelancer Bid
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Place a bid on a freelancer project with specified amount, timeline, and proposal description
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div><strong>Parameters:</strong></div>
                <div>• projectId: ID of the project (required)</div>
                <div>• bidderId: Your user ID (required)</div>
                <div>• amount: Bid amount (required)</div>
                <div>• period: Days to complete (required)</div>
                <div>• description: Proposal description (optional)</div>
                <div>• milestonePercentage: Milestone payment % (default: 100)</div>
              </div>
              <div className="mt-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 rounded text-xs text-green-700 dark:text-green-300">
                ✅ Live API integration with Freelancer.com
              </div>
            </div>
          </div>
        </div>

        {/* Vehicle Maintenance Tools Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Vehicle Maintenance Tools
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
            Track vehicle services, parts, and maintenance schedules with these tools.
          </p>
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                🚗 vehicle_manage
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Add, update, or delete vehicles from your fleet
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div>• action: add, update, or delete</div>
                <div>• name, make, model, year, vin, odometer</div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                📋 vehicle_list
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                List all tracked vehicles with current odometer readings
              </p>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                🔧 vehicle_add_service
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Log a service with date, type, cost, provider, and parts used
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div>• vehicleId, serviceDate, serviceType</div>
                <div>• odometer, cost, provider, notes</div>
                <div>• parts: inline part creation with quantity</div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                📜 vehicle_get_services
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Get service history with optional filters
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div>• Filter by vehicle, type, date range</div>
                <div>• Includes parts used in each service</div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                🔩 vehicle_add_part / vehicle_get_parts
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Register and search reusable parts with manufacturer, part number, cost, and purchase URL
              </p>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                📅 vehicle_set_schedule
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Create maintenance schedules with km and/or time intervals
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div>• intervalKm: e.g., every 10,000 km</div>
                <div>• intervalMonths: e.g., every 6 months</div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                🚨 vehicle_get_upcoming
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Get overdue and upcoming maintenance items based on schedules and current odometer
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <div>• Shows overdue items with km/days overdue</div>
                <div>• Shows due soon items with km/days remaining</div>
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                ⚙️ vehicle_manage_service / vehicle_get_schedules
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                Update/delete service records and view all maintenance schedules for a vehicle
              </p>
            </div>
          </div>
          <div className="mt-6 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300 max-w-2xl mx-auto">
            Requires Vercel Postgres database. Data persists across sessions.
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            🔑 Authentication Required
          </h3>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Connect your Freelancer account to enable project search functionality.
          </p>
          <a
            href="/auth"
            className="inline-flex items-center bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 2l3-3h6l3 3m-6-9v-2a3 3 0 01.879-2.121m0 0a3 3 0 013.242 0M12 6V4"></path>
            </svg>
            Connect Account
          </a>
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