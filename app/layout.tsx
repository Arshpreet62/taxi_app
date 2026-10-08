import type { Metadata, Viewport } from 'next'
import { Overpass, Overpass_Mono } from 'next/font/google'
import { BUSINESS } from '@/lib/business'
import './globals.css'

const sans = Overpass({ subsets: ['latin'], variable: '--font-sans', style: ['normal', 'italic'] })
const mono = Overpass_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['600', '700'] })

export const metadata: Metadata = {
  metadataBase: new URL(BUSINESS.site),
  title: 'Harbour Ride',
  description: 'Book a taxi around Sydney and see the fare on the meter before you commit. Pay the driver at the end, cash or card.',
  openGraph: {
    title: 'Harbour Ride: know the fare before the taxi moves',
    description: 'Sydney taxi bookings with the fare quoted up front and held for 15 minutes.',
    type: 'website',
    locale: 'en_AU',
  },
}

export const viewport: Viewport = { themeColor: '#f3f6f6', width: 'device-width', initialScale: 1 }

// Applies the saved day/night choice before first paint, so night shift doesn't flash white.
const themeScript = `try{var t=localStorage.getItem('hr-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
