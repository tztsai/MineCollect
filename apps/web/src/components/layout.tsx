import { Link } from 'react-router-dom'
import { Database } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
            <Database className="h-5 w-5" />
            <span>MineCollect Explorer</span>
          </Link>
          <nav>
            <ul className="flex gap-4">
              <li>
                <Link to="/" className="text-sm hover:underline">
                  Sources
                </Link>
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
  )
} 