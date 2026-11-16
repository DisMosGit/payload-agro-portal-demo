import Link from 'next/link'

export default function HomePage() {
  return (
    <div>
      <h1>Demo Site</h1>
      <p>This is the public front end. Content is managed through the admin panel.</p>
      <p>
        <Link href="/admin">Open the admin panel</Link>
      </p>
    </div>
  )
}
