import React from 'react'

export const metadata = {
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
