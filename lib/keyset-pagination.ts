export type DateIdCursor = { date: Date; id: string }

export function encodeDateIdCursor(date: Date, id: string): string {
    return Buffer.from(JSON.stringify({ date: date.toISOString(), id }), 'utf8').toString('base64url')
}

export function decodeDateIdCursor(value: string | null): DateIdCursor | null | false {
    if (!value) return null
    if (value.length > 512) return false
    try {
        const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { date?: unknown; id?: unknown }
        if (typeof parsed.date !== 'string' || typeof parsed.id !== 'string' || parsed.id.length < 1 || parsed.id.length > 200) return false
        const date = new Date(parsed.date)
        if (Number.isNaN(date.getTime()) || date.toISOString() !== parsed.date) return false
        return { date, id: parsed.id }
    } catch {
        return false
    }
}

export function parsePageSize(value: string | null, fallback = 50, maximum = 100): number | null {
    if (value === null) return fallback
    const limit = Number(value)
    return Number.isInteger(limit) && limit >= 1 && limit <= maximum ? limit : null
}
