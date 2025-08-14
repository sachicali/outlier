import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues
const ComponentShowcase = dynamic(
  () => import('../../components/ui/ComponentShowcase'),
  { ssr: false }
);

export default function TestPage() {
  const [apiStatus, setApiStatus] = useState('Checking...');
  const [frontendWorking, setFrontendWorking] = useState(false);
  const [showComponents, setShowComponents] = useState(false);

  useEffect(() => {
    setFrontendWorking(true);
    
    // Test API connection
    const testAPI = async () => {
      try {
  const response = await fetch('http://localhost:5000/health');
        const data = await response.json();
        setApiStatus(`API Working: ${data.status}`);
      } catch (error) {
        setApiStatus(`API Error: ${error.message}`);
      }
    };

    testAPI();
  }, []);

  if (showComponents) {
    return (
      <>
        <Head>
          <title>Component Showcase - YouTube Outlier Discovery</title>
        </Head>
        <ComponentShowcase />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Test Page - YouTube Outlier Discovery</title>
      </Head>
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">System Test Page</h1>
          
          <div className="space-y-6">
            <div className="border-l-4 border-green-400 bg-green-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Frontend Status
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>React Frontend: {frontendWorking ? '✅ Working' : '❌ Not Working'}</p>
                    <p>Current Time: {new Date().toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className={`border-l-4 p-4 ${
              apiStatus.includes('Working') 
                ? 'border-green-400 bg-green-50' 
                : 'border-red-400 bg-red-50'
            }`}>
              <div className="flex">
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${
                    apiStatus.includes('Working') ? 'text-green-800' : 'text-red-800'
                  }`}>
                    API Status
                  </h3>
                  <div className={`mt-2 text-sm ${
                    apiStatus.includes('Working') ? 'text-green-700' : 'text-red-700'
                  }`}>
                    <p>{apiStatus}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-l-4 border-blue-400 bg-blue-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Environment Variables
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>NODE_ENV: <span className="font-mono">{process.env.NODE_ENV || 'undefined'}</span></p>
                    <p>NEXT_PUBLIC_API_URL: <span className="font-mono">{process.env.NEXT_PUBLIC_API_URL || 'undefined'}</span></p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-l-4 border-purple-400 bg-purple-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-purple-800">
                    UI Components Test
                  </h3>
                  <div className="mt-2 text-sm text-purple-700">
                    <p>Test all loading states, skeletons, and responsive components</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <button 
              onClick={() => window.location.href = '/'}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              ← Back to Home
            </button>
            
            <button 
              onClick={() => window.location.href = '/discovery'}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go to Discovery Tool
            </button>

            <button 
              onClick={() => setShowComponents(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            >
              View Component Showcase
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
