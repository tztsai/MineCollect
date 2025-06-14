import { db } from '@minecollect/db'
import { sources, nodes } from '@minecollect/db/schema'
import { desc, eq, asc } from 'drizzle-orm'

export async function getSources() {
  return db.select().from(sources).orderBy(desc(sources.addedAt)).limit(100)
}

export async function getSourceById(id: string) {
  return db.select().from(sources).where(eq(sources.id, id)).limit(1)
    .then(result => result[0])
}

export async function getNodesForSource(sourceId: string) {
  return db.select().from(nodes).where(eq(nodes.sourceId, sourceId)).orderBy(asc(nodes.position))
}

export async function getNodeById(id: string) {
  return db.select().from(nodes).where(eq(nodes.id, id)).limit(1)
    .then(result => result[0])
} 