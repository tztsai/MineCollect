import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <h2 className="text-xl font-semibold mb-2">Not Found</h2>
      <p className="text-muted-foreground mb-4">The resource you requested could not be found.</p>
      <Link 
        href="/" 
        className="text-sm px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
      >
        Return Home
      </Link>
    </div>
  )
} 