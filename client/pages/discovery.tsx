import Head from 'next/head'
import { withAuth } from '../contexts/AuthContext'
import dynamic from 'next/dynamic'

// Dynamic import to avoid SSR issues with client-side components
const YouTubeOutlierApp = dynamic(
  () => import('../components/YouTubeOutlierApp'),
  { ssr: false }
)

function DiscoveryPage() {
  return (
    <>
      <Head>
        <title>YouTube Outlier Discovery Tool</title>
        <meta name="description" content="Discover high-performing YouTube videos from adjacent channels" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <YouTubeOutlierApp />
    </>
  )
}

export default withAuth(DiscoveryPage)