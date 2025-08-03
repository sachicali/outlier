import React from 'react';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import RegisterForm from '../components/auth/RegisterForm';

export default function RegisterPage() {
  return (
    <>
      <Head>
        <title>Create Account - YouTube Outlier Discovery</title>
        <meta name="description" content="Create your YouTube Outlier Discovery account" />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
              YouTube Outlier Discovery
            </h1>
            <p className="text-gray-600">
              Join thousands of content creators and marketers
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <RegisterForm redirectTo="/" />
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our{' '}
            <a href="/terms" className="text-green-600 hover:text-green-500">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-green-600 hover:text-green-500">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>

      <Toaster position="top-right" />
    </>
  );
}