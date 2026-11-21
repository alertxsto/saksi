import type { Metadata, Viewport } from 'next'
import { Doto, Geist, Geist_Mono } from 'next/font/google'
import { Providers } from '@/lib/client/providers'
import { ToastProvider } from '@/components/ui/Toast'
import { SITE_URL } from '@/lib/env'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
// Dot-matrix display face, used only for big numerals. Falls back to Geist Mono via --font-dot.
const doto = Doto({ variable: '--font-doto', subsets: ['latin'], axes: ['ROND'], display: 'swap' })

const TITLE = 'Saksi — a witness for your personal data'
const DESCRIPTION =
  'Saksi seals a fingerprint of every access to your personal data on a public chain, so you can check it yourself.'

// Link preview: PNG (WhatsApp drops webp and large files), 1200×630, under 300 KB; key content in the centre
// 630×630 so WhatsApp's square crop keeps it. Source: app/dev/og (riset-ui/31-errors-og-log.md).
const OG_IMAGE = {
  url: '/og/saksi-og.png',
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Saksi: Who opened your data? Now there’s a witness.',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s · Saksi' },
  description: DESCRIPTION,
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Saksi',
    type: 'website',
    images: [OG_IMAGE],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
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
