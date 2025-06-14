import { format } from 'date-fns'
import { db } from '@minecollect/db'
import { sources, nodes } from '@minecollect/db/schema'
import { eq, asc } from 'drizzle-orm'
import Link from 'next/link'
import { ExternalLink, ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

interface SourceDetailPageProps {
  params: {
    id: string
  }
}

export default async function SourceDetailPage({ params }: SourceDetailPageProps) {
  const source = await db.select().from(sources).where(eq(sources.id, params.id))
    .then(results => results[0])

  if (!source) {
    notFound()
  }

  const nodesList = await db.select().from(nodes).where(eq(nodes.sourceId, params.id))
    .orderBy(asc(nodes.sortOrder))

  // Get root nodes (nodes without parents)
  const rootNodes = nodesList.filter(node => !node.parentId)
  
  // Get child nodes for a given parent
  const getChildNodes = (parentId: string) => {
    return nodesList.filter(node => node.parentId === parentId)
  }

  // Render a node and its children recursively
  const renderNode = (node: any) => {
    const childNodes = getChildNodes(node.id)
    
    return (
      <div key={node.id} className="border-l pl-4 my-2">
        <div className="p-2 rounded">
          <div className="flex-1">
            <div className="font-medium">{node.path}</div>
            <div className="whitespace-pre-wrap text-sm">{node.content}</div>
            {node.metadata && (
              <div className="mt-2 text-xs text-muted-foreground">
                <details>
                  <summary>Metadata</summary>
                  <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                    {JSON.stringify(node.metadata, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        </div>
        
        {childNodes.length > 0 && (
          <div className="ml-4">
            {childNodes.map((childNode: any) => renderNode(childNode))}
          </div>
        )}
      </div>
    )
  }

  // Safely check if metadata exists and has content
  const hasMetadata = source.metadata !== null && 
                      source.metadata !== undefined && 
                      typeof source.metadata === 'object';

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to sources
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{source.sourceUri}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              Added: {format(source.addedAt, 'PPP')}
            </div>
          </div>
          
          <a 
            href={source.sourceUri} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex items-center gap-1 text-sm px-3 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
          >
            View Original <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      
      <div className="space-y-6">
        {hasMetadata && (
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-2">Source Metadata</h2>
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
              {JSON.stringify(source.metadata, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Content</h2>
          
          {rootNodes.length === 0 ? (
            <div className="text-muted-foreground">No content nodes found for this source.</div>
          ) : (
            <div className="space-y-2">
              {rootNodes.map(renderNode)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 