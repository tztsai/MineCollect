import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowLeft, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react'
import { getSourceById, getNodesForSource } from '../lib/db'

type Source = {
  id: string
  name: string
  url: string
  type: string
  createdAt: Date
  metadata: Record<string, any>
}

type Node = {
  id: string
  sourceId: string
  parentId: string | null
  type: string
  content: string
  metadata: Record<string, any>
  position: number
}

export function SourceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [source, setSource] = useState<Source | null>(null)
  const [nodes, setNodes] = useState<Node[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      if (!id) return
      
      try {
        const [sourceData, nodesData] = await Promise.all([
          getSourceById(id),
          getNodesForSource(id)
        ])
        
        if (!sourceData) {
          setError('Source not found')
          return
        }
        
        setSource(sourceData)
        setNodes(nodesData)
      } catch (err) {
        setError('Failed to load data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }))
  }

  // Get root nodes (nodes without parents)
  const rootNodes = nodes.filter(node => !node.parentId)
  
  // Get child nodes for a given parent
  const getChildNodes = (parentId: string) => {
    return nodes.filter(node => node.parentId === parentId)
  }

  // Render a node and its children recursively
  const renderNode = (node: Node) => {
    const childNodes = getChildNodes(node.id)
    const isExpanded = expandedNodes[node.id]
    
    return (
      <div key={node.id} className="border-l pl-4 my-2">
        <div 
          className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
          onClick={() => toggleNode(node.id)}
        >
          <div className="mt-1">
            {childNodes.length > 0 ? (
              isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : null}
          </div>
          <div className="flex-1">
            <div className="font-medium">{node.type}</div>
            <div className="whitespace-pre-wrap text-sm">{node.content}</div>
            {Object.keys(node.metadata).length > 0 && (
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
        
        {isExpanded && childNodes.length > 0 && (
          <div className="ml-4">
            {childNodes.map(renderNode)}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (error || !source) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500">{error || 'Source not found'}</div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to sources
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{source.name}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              Type: {source.type} • Added: {format(new Date(source.createdAt), 'PPP')}
            </div>
          </div>
          
          {source.url && (
            <a 
              href={source.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-1 text-sm px-3 py-1 bg-secondary text-secondary-foreground rounded hover:bg-secondary/90"
            >
              View Original <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      
      <div className="space-y-6">
        {Object.keys(source.metadata).length > 0 && (
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