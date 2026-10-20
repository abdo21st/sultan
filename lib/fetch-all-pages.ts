'use client'

export async function fetchAllPages<T>(path: string): Promise<T[]> {
    const url = new URL(path, window.location.origin)
    url.searchParams.set('limit', '100')
    const items: T[] = []
    let cursor: string | null = null

    do {
        if (cursor) url.searchParams.set('cursor', cursor)
        else url.searchParams.delete('cursor')
        const response = await fetch(url, { cache: 'no-store' })
        if (!response.ok) throw new Error('تعذر تحميل البيانات.')
        const page = await response.json()
        if (!Array.isArray(page)) throw new Error('استجابة غير متوقعة من الخادم.')
        items.push(...page as T[])
        cursor = response.headers.get('X-Next-Cursor')
    } while (cursor)

    return items
}
