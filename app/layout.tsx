'use client'

import { useEffect } from 'react'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const initializeMiniApp = async () => {
      try {
        const url = new URL(window.location.href)
        const isMini =
          url.pathname.startsWith('/mini') ||
          url.searchParams.get('miniApp') === 'true'

        if (isMini) {
          const { sdk } = await import('@farcaster/miniapp-sdk')
          sdk.actions.ready() // 👈 penting! wajib dipanggil
          console.log('Farcaster Mini App initialized 🚀')
        }
      } catch (err) {
        console.error('Mini App init failed:', err)
      }
    }

    initializeMiniApp()
  }, [])

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
