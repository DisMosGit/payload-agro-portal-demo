import type { Metadata } from 'next'
import React from 'react'

import { getSiteURL } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(getSiteURL()),
  description: 'Public front end for a Payload CMS content site.',
  title: 'Demo Site',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
