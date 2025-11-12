// app/layout.tsx
'use client'
import { useEffect } from 'react'
 
export default function RootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const url = new URL(window.location.href)
    const isMini =
      url.pathname.startsWith('/mini') ||
      url.searchParams.get('miniApp') === 'true'
 
    if (isMini) {
      import('@farcaster/miniapp-sdk').then(({ sdk }) => {
        // Mini-App–specific bootstrap here
        // e.g. sdk.actions.ready()
      })
    }
  }, [])
 
  return children
}