import { db } from '@minecollect/db'

export async function getSources() {
  return db.source.findMany({
    orderBy: { createdAt: 'desc' },
  })
}

export async function getSourceById(id: string) {
  return db.source.findUnique({
    where: { id },
  })
}

export async function getNodesForSource(sourceId: string) {
  return db.node.findMany({
    where: { sourceId },
    orderBy: { position: 'asc' },
  })
}

export async function getNodeById(id: string) {
  return db.node.findUnique({
    where: { id },
    include: {
      children: {
        orderBy: { position: 'asc' },
      },
    },
  })
} 