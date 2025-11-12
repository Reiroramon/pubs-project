'use client'

import { useEffect } from 'react'
import { sdk } from '@farcaster/miniapp-sdk'
import Providers from './providers'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const url = new URL(window.location.href)
    const isMiniApp =
      url.pathname.startsWith('/mini') ||
      url.searchParams.get('miniApp') === 'true' ||
      (window.navigator.userAgent.toLowerCase().includes('farcaster'))

    if (isMiniApp) {
      sdk.actions.ready({
        disableNativeGestures: true,
      })
    }
  }, [])

  return (
    <html lang="en">
      <head>
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
                splashBackgroundColor: '#0A0A0A',
              },
            },
          })}
        />
      </head>

      <body className="bg-[#0A0A0A] text-gray-100">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
