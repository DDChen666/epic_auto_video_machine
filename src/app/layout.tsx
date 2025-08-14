import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Epic Auto Video Machine',
  description:
    'Transform your stories into stunning videos automatically with AI-powered scene generation, voice synthesis, and professional editing.',
  keywords:
    'video generation, AI, automation, TTS, image generation, Gemini API',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="dark" storageKey="epic-video-theme">
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
