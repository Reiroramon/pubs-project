'use client'

import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      // Deteksi apakah app dibuka dari Farcaster Mini App environment
      const url = new URL(window.location.href)
      const isMiniApp =
        url.pathname.startsWith('/mini') ||
        url.searchParams.get('miniApp') === 'true' ||
        (window.navigator.userAgent.toLowerCase().includes('farcaster'))

      // Jika Mini App, inisialisasi SDK
      if (isMiniApp) {
        sdk.actions.ready({
          disableNativeGestures: true // cegah gesture close di modal
        })
      }
    } catch (e) {
      console.warn('MiniApp detection failed:', e)
    }
  }, [])

  return (
    <html lang="en">
      <head>
        {/* Meta untuk Farcaster Mini App */}
        <meta
          name="fc:miniapp"
          content={JSON.stringify({
            version: '1',
            imageUrl: 'https://pubs-burn.vercel.app/image.png',
            button: {
              title: 'Open PUBS BURN',
              action: {
                type: 'launch_frame',
                name: 'PUBS BURN',
                url: 'https://pubs-burn.vercel.app',
                splashImageUrl: 'https://pubs-burn.vercel.app/splash.png',
                splashBackgroundColor: '#0A0A0A'
              }
            }
          })}
        />
      </head>

      <body className="bg-[#0A0A0A] text-gray-100">
        {children}
      </body>
    </html>
  )
}
