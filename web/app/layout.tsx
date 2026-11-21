import type { Metadata, Viewport } from 'next'
import { Doto, Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/lib/client/providers'
import { ToastProvider } from '@/components/ui/Toast'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
// Dot-matrix display face, used only for big numerals. Falls back to Geist Mono via --font-dot.
const doto = Doto({ variable: '--font-doto', subsets: ['latin'], axes: ['ROND'], display: 'swap' })

const TITLE = 'Saksi — a witness for your personal data'
const DESCRIPTION =
  'Saksi seals a fingerprint of every access to your personal data on a public chain, so you can check it yourself.'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3401'),
  title: { default: TITLE, template: '%s · Saksi' },
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/brand/saksi-app-icon-512.png', sizes: '512x512', type: 'image/png' }],
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Saksi',
    type: 'website',
    images: [{ url: '/img/og-cover-s.webp', width: 1200, height: 630, alt: 'Saksi' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: ['/img/og-cover-s.webp'] },
}

export const viewport: Viewport = {
  themeColor: '#F4F2EC',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${doto.variable} antialiased`}>
      <body className="min-h-dvh bg-paper text-ink">
        <a
          href="#main"
          className="label sr-only z-50 bg-ink px-4 py-3 text-paper focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Providers>
          <ToastProvider>{children}</ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
