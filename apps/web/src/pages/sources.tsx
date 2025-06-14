import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ExternalLink } from 'lucide-react'
import { getSources } from '../lib/db'

type Source = {
  id: string
  name: string
  url: string
  type: string
  createdAt: Date
}

export function SourcesPage() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchSources() {
      try {
        const data = await getSources()
        setSources(data)
      } catch (err) {
        setError('Failed to load sources')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchSources()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading sources...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  if (sources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h2 className="text-xl font-semibold mb-2">No sources found</h2>
        <p className="text-muted-foreground">Import some data using the ingestion scouts first.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sources</h1>
      <div className="grid gap-4">
        {sources.map((source) => (
          <div key={source.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="font-semibold text-lg">
                  <Link to={`/sources/${source.id}`} className="hover:underline">
                    {source.name}
                  </Link>
                </h2>
                <div className="text-sm text-muted-foreground">
                  Type: {source.type}
                </div>
                <div className="text-sm text-muted-foreground">
                  Added: {format(new Date(source.createdAt), 'PPP')}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/sources/${source.id}`} className="text-sm px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90">
                  View
                </Link>
                {source.url && (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm px-3 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90">
                    Original <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
} 