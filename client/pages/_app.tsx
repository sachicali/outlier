import '../styles/globals.css'
import type { AppProps } from 'next/app'
import ErrorBoundary from '../components/ErrorBoundary'
import { ErrorProvider } from '../contexts/ErrorContext'
import { AuthProvider } from '../contexts/AuthContext'
import ErrorToastContainer from '../components/ErrorToast'
import { Toaster } from 'react-hot-toast'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorProvider>
      <AuthProvider>
        <ErrorBoundary level="page">
          <Component {...pageProps} />
          <ErrorToastContainer />
          <Toaster position="top-right" />
        </ErrorBoundary>
      </AuthProvider>
    </ErrorProvider>
  )
}
