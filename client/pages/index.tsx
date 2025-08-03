import Head from 'next/head'
import { useAuth, withAuth } from '../contexts/AuthContext'
import { LogOut, User, Settings, Key } from 'lucide-react'

function Home() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <Head>
        <title>YouTube Outlier Discovery Tool</title>
        <meta name="description" content="Discover high-performing YouTube videos from adjacent channels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center">
                <h1 className="text-3xl font-bold text-gray-900">
                  YouTube Outlier Discovery
                </h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <User className="w-4 h-4" />
                  <span>Welcome, {user?.username}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    user?.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user?.role}
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <a
                    href="/profile"
                    className="text-gray-600 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                    title="Profile"
                  >
                    <Settings className="w-4 h-4" />
                  </a>
                  
                  <a
                    href="/api-keys"
                    className="text-gray-600 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                    title="API Keys"
                  >
                    <Key className="w-4 h-4" />
                  </a>
                  
                  <button
                    onClick={handleLogout}
                    className="text-gray-600 hover:text-gray-900 p-2 rounded-md hover:bg-gray-100"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex flex-col items-center justify-center">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  🚀 Authentication System Active!
                </h2>
                <p className="text-gray-600 mb-8">
                  The secure authentication and authorization system is now implemented.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">🔐 JWT Authentication</h3>
                    <p className="text-sm text-gray-600">
                      Secure token-based authentication with refresh tokens and httpOnly cookies
                    </p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">🛡️ RBAC System</h3>
                    <p className="text-sm text-gray-600">
                      Role-based access control with user and admin roles
                    </p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">🔑 API Key Management</h3>
                    <p className="text-sm text-gray-600">
                      Per-user API keys with scoped permissions and rate limiting
                    </p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">🔒 Secure Endpoints</h3>
                    <p className="text-sm text-gray-600">
                      All analysis endpoints protected with authentication
                    </p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">🔐 Password Security</h3>
                    <p className="text-sm text-gray-600">
                      Bcrypt hashing with 12+ rounds and strong password policies
                    </p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-gray-900 mb-2">⚡ Ready to Use</h3>
                    <p className="text-sm text-gray-600">
                      Complete UI components for login, registration, and profile management
                    </p>
                  </div>
                </div>

                <div className="mt-8 space-x-4">
                  <a
                    href="/dashboard"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    View Dashboard
                  </a>
                  <a
                    href="/discovery"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                  >
                    Launch Discovery Tool
                  </a>
                  <a
                    href="/test"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Test API Connectivity
                  </a>
                  <a
                    href="/profile"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    View Profile
                  </a>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}

export default withAuth(Home);
