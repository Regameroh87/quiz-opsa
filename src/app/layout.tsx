import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Quiz New Holland',
  icons: '/favicon.svg',
}

export const viewport: Viewport = {
  themeColor: '#00153f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
