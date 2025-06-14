import { format } from 'date-fns'
import { db } from '@minecollect/db'
import { sources } from '@minecollect/db/schema'
import { desc } from 'drizzle-orm'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'

export default async function HomePage() {
  const sourcesList = await db.select().from(sources).orderBy(desc(sources.addedAt))

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Sources</h1>
      
      {sourcesList.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <h2 className="text-xl font-semibold mb-2">No sources found</h2>
          <p className="text-muted-foreground">Import some data using the ingestion scouts first.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {sourcesList.map((source) => (
            <div key={source.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="font-semibold text-lg">
                    <Link href={`/sources/${source.id}`} className="hover:underline">
                      {source.sourceUri}
                    </Link>
                  </h2>
                  <div className="text-sm text-muted-foreground">
                    Added: {format(source.addedAt, 'PPP')}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link 
                    href={`/sources/${source.id}`} 
                    className="text-sm px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
                  >
                    View
                  </Link>
                  <a 
                    href={source.sourceUri} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="flex items-center gap-1 text-sm px-3 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
                  >
                    Original <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 