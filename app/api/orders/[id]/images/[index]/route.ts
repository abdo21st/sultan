import { get } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/permissions'
import { canAccessOrderFacility, canViewOrderStatus, getRequestUser } from '@/lib/request-user'
import { verifyOrderShareToken } from '@/lib/order-share-token'
import { parseLocalImageReference, readLocalImage } from '@/lib/local-image-storage'

export const dynamic = 'force-dynamic'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string; index: string }> },
) {
    const { id, index: indexText } = await params
    const index = Number(indexText)
    if (!Number.isSafeInteger(index) || index < 0) return new Response('Not found', { status: 404 })

    const url = new URL(request.url)
    const token = url.searchParams.get('token') ?? undefined
    const hasShareAccess = verifyOrderShareToken(token, id)
    const user = hasShareAccess ? null : await getRequestUser()
    if (!hasShareAccess && !user?.permissions.includes(PERMISSIONS.ORDERS_VIEW)) {
        return new Response('Not found', { status: 404 })
    }

    const order = await prisma.order.findUnique({
        where: { id },
        select: { factoryId: true, shopId: true, status: true, images: true },
    })
    if (!order) return new Response('Not found', { status: 404 })
    if (user && (!canAccessOrderFacility(user, order) || !canViewOrderStatus(user, order.status))) {
        return new Response('Not found', { status: 404 })
    }

    const blobUrl = order.images[index]
    if (!blobUrl) return new Response('Not found', { status: 404 })

    if (parseLocalImageReference(blobUrl)) {
        try {
            const image = await readLocalImage(blobUrl)
            if (!image) return new Response('Not found', { status: 404 })
            const headers = new Headers({
                ETag: image.etag,
                'Cache-Control': 'private, no-cache',
                'X-Content-Type-Options': 'nosniff',
                'Content-Security-Policy': "default-src 'none'; sandbox",
            })
            if (request.headers.get('if-none-match') === image.etag) return new Response(null, { status: 304, headers })
            headers.set('Content-Type', image.contentType)
            return new Response(image.data, { headers })
        } catch {
            return NextResponse.json({ error: 'تعذر تحميل الصورة.' }, { status: 502 })
        }
    }

    let blob: URL
    try {
        blob = new URL(blobUrl)
    } catch {
        return new Response('Not found', { status: 404 })
    }
    if (blob.protocol !== 'https:' || blob.username || blob.password || !blob.hostname.endsWith('.blob.vercel-storage.com')) {
        return new Response('Not found', { status: 404 })
    }

    try {
        const access = blob.hostname.endsWith('.private.blob.vercel-storage.com') ? 'private' : 'public'
        const result = await get(blobUrl, {
            access,
            ifNoneMatch: request.headers.get('if-none-match') ?? undefined,
        })
        if (!result) return new Response('Not found', { status: 404 })

        const headers = new Headers({
            ETag: result.blob.etag,
            'Cache-Control': 'private, no-cache',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy': "default-src 'none'; sandbox",
        })
        if (result.statusCode === 304) return new Response(null, { status: 304, headers })
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(result.blob.contentType)) {
            return new Response('Unsupported media type', { status: 415 })
        }
        headers.set('Content-Type', result.blob.contentType)
        return new Response(result.stream, { headers })
    } catch {
        return NextResponse.json({ error: 'تعذر تحميل الصورة.' }, { status: 502 })
    }
}
