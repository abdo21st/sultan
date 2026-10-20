import { config as loadEnv } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

loadEnv({ path: '.env.local', quiet: true })
loadEnv({ path: '.env', quiet: true })

const APPLY = process.argv.includes('--apply')
const MAX_FILE_SIZE = 4.5 * 1024 * 1024

function classifyUrl(value: string): 'private' | 'public' | 'unsupported' {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return 'unsupported'
    if (url.hostname.endsWith('.private.blob.vercel-storage.com')) return 'private'
    if (url.hostname.endsWith('.public.blob.vercel-storage.com')) return 'public'
  } catch {
    return 'unsupported'
  }
  return 'unsupported'
}

async function main() {
  if (APPLY && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Private Blob storage token is not configured.')
  }

  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error('Database connection is not configured.')
  const pool = new pg.Pool({ connectionString, max: 2, connectionTimeoutMillis: 10_000 })
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
  const { saveFile } = await import('../lib/upload')
  const { enqueueBlobDeletions, processBlobDeletionQueue } = await import('../lib/blob-cleanup')
  const { del } = await import('@vercel/blob')
  let scanned = 0
  let privateCount = 0
  let publicCount = 0
  let unsupportedCount = 0
  let migratedCount = 0
  let cursor: string | undefined

  try {
    while (true) {
      const orders = await prisma.order.findMany({
        select: { id: true, images: true },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })
      if (orders.length === 0) break

      for (const order of orders) {
        scanned += order.images.length
        const imageKinds = order.images.map(classifyUrl)
        privateCount += imageKinds.filter((kind) => kind === 'private').length
        publicCount += imageKinds.filter((kind) => kind === 'public').length
        unsupportedCount += imageKinds.filter((kind) => kind === 'unsupported').length

        if (APPLY && imageKinds.includes('public')) {
          const nextImages = [...order.images]
          const uploadedUrls: string[] = []
          for (let index = 0; index < order.images.length; index += 1) {
            if (imageKinds[index] !== 'public') continue
            const response = await fetch(order.images[index], { signal: AbortSignal.timeout(20_000) })
            if (!response.ok) throw new Error('Legacy image download failed.')
            const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || ''
            const contentLength = Number(response.headers.get('content-length'))
            if (!contentType.startsWith('image/') || (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE)) {
              throw new Error('Legacy image is not a supported image file.')
            }
            const bytes = await response.arrayBuffer()
            if (bytes.byteLength > MAX_FILE_SIZE) throw new Error('Legacy image exceeds the supported size.')
            const file = new File([bytes], `legacy-${index}`, { type: contentType })
            const privateUrl = await saveFile(file, 'migrated')
            if (!privateUrl) throw new Error('Private image upload failed.')
            nextImages[index] = privateUrl
            uploadedUrls.push(privateUrl)
          }

          const cleanup = await prisma.$transaction(async (tx) => {
            const updated = await tx.order.updateMany({
              where: { id: order.id, images: { equals: order.images } },
              data: { images: nextImages },
            })
            if (updated.count !== 1) return { updated: false, ids: [] as string[] }
            const queue = await enqueueBlobDeletions(
              tx,
              order.images.filter((_, index) => imageKinds[index] === 'public'),
              order.id,
            )
            return { updated: true, ids: queue.ids }
          })
          if (!cleanup.updated) {
            await del(uploadedUrls).catch(() => undefined)
            throw new Error('Order images changed during migration.')
          }
          if (cleanup.ids.length > 0) {
            await processBlobDeletionQueue({ ids: cleanup.ids }).catch(() => undefined)
          }
          migratedCount += uploadedUrls.length
        }
      }

      cursor = orders[orders.length - 1].id
      if (orders.length < 100) break
    }
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    imageCount: scanned,
    alreadyPrivate: privateCount,
    legacyPublic: publicCount,
    unsupported: unsupportedCount,
    migrated: migratedCount,
  }, null, 2))
  if (unsupportedCount > 0) process.exitCode = 2
}

main().catch(() => {
  console.error('Image migration stopped. Review the storage configuration and retry; no image URLs were printed.')
  process.exitCode = 1
})
