import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n'
import GlobalLanguageToggle from '@/components/GlobalLanguageToggle'
import SiteAssistant from '@/components/SiteAssistant'

export const metadata: Metadata = {
  title: 'SiteSync Pro  Equipment Service Management',
  description: 'Real-time service scheduling and tracking for jobsite equipment rentals',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-white antialiased">
        <LanguageProvider>
          {children}
          <SiteAssistant />
          <GlobalLanguageToggle />
        </LanguageProvider>
      </body>
    </html>
  )
}
