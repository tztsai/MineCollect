import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MineCollect - Data Explorer',
  description: 'Explore your collected data from various sources',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <header className="border-b">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2 font-semibold text-lg">
                <span>MineCollect Explorer</span>
              </a>
              <nav>
                <ul className="flex gap-4">
                  <li>
                    <a href="/" className="text-sm hover:underline">
                      Sources
                    </a>
                  </li>
                </ul>
              </nav>
            </div>
          </header>
          <main className="flex-1 container mx-auto px-4 py-6">
            {children}
          </main>
          <footer className="border-t py-4">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              MineCollect Data Explorer
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
} 