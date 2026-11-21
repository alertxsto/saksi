'use client'

import { Doto, Geist, Geist_Mono } from 'next/font/google'
import { ReconnectScreen } from '@/components/system/ReconnectScreen'
import './globals.css'

// global-error replaces the root layout, so it brings its own document, fonts and styles.
const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const doto = Doto({ variable: '--font-doto', subsets: ['latin'], axes: ['ROND'], display: 'swap' })

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${doto.variable} antialiased`}>
      <body className="min-h-dvh bg-paper text-ink">
        <title>Reconnecting · Saksi</title>
        <ReconnectScreen error={error} retry={retry} />
      </body>
    </html>
  )
}
