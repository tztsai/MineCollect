/**
 * Utility function to create ltree path from segments
 * Sanitizes segments to be valid ltree labels (alphanumeric and underscores only)
 */
export function createPath(...segments: string[]): string {
  return segments
    .map(s => s.replace(/[^a-zA-Z0-9_]/g, '_'))
    .join('.');
} 