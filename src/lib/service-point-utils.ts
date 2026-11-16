/**
 * Pure display helpers shared by the server-rendered list and the client map.
 * Keep this module free of Payload and DOM imports.
 */

/**
 * Only `http:` and `https:` values become links in the page or popup. Anything
 * else is shown as plain text so an authored value cannot introduce a
 * `javascript:` or `data:` URL.
 */
export function safeWebsiteURL(value: string | null | undefined): string | null {
  const trimmed = value?.trim()

  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)

    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function phoneHref(value: string): string {
  return `tel:${value.replace(/\s+/g, '')}`
}
