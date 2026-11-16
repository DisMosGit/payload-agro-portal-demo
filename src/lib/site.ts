export function getSiteURL(): string {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL?.trim()

  if (configured) {
    try {
      return new URL(configured).toString().replace(/\/$/, '')
    } catch {
      // Fall through to the local default so a malformed deployment value
      // cannot break metadata generation.
    }
  }

  return 'http://localhost:3000'
}

export function absoluteURL(pathname: string): string {
  return new URL(pathname, `${getSiteURL()}/`).toString()
}
