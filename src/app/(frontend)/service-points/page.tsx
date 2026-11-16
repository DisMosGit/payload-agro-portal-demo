import type { Metadata } from 'next'

import { getServicePoints, toMarkerData } from '@/lib/service-points'
import { phoneHref, safeWebsiteURL } from '@/lib/service-point-utils'

import ServicePointsMapLoader from './ServicePointsMapLoader'
import styles from './service-points.module.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Service points',
  description: 'Find dealers, service centres, and warehouses on the map.',
}

export default async function ServicePointsPage() {
  const points = (await getServicePoints()).map(toMarkerData)

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Service points</h1>
        <p>Find dealers, service centres, and warehouses on the map.</p>
      </header>

      {points.length === 0 ? (
        <p className={styles.empty}>No service points have been added yet.</p>
      ) : (
        <>
          <ServicePointsMapLoader points={points} />

          <section aria-labelledby="service-point-list-heading">
            <h2 id="service-point-list-heading" className={styles.listHeading}>
              All service points
            </h2>

            <div className={styles.list}>
              {points.map((point) => {
                const websiteURL = safeWebsiteURL(point.website)
                const hasContacts = Boolean(point.phone || point.email || point.website)

                return (
                  <article key={point.id} className={styles.card}>
                    <h3>{point.name}</h3>
                    {point.typeLabel ? <p className={styles.type}>{point.typeLabel}</p> : null}
                    {point.address ? <p className={styles.address}>{point.address}</p> : null}

                    {hasContacts ? (
                      <ul className={styles.contactList}>
                        {point.phone ? (
                          <li>
                            Phone: <a href={phoneHref(point.phone)}>{point.phone}</a>
                          </li>
                        ) : null}
                        {point.email ? (
                          <li>
                            Email: <a href={`mailto:${point.email}`}>{point.email}</a>
                          </li>
                        ) : null}
                        {point.website ? (
                          <li>
                            Website:{' '}
                            {websiteURL ? (
                              <a href={websiteURL} target="_blank" rel="noreferrer noopener">
                                {point.website}
                              </a>
                            ) : (
                              point.website
                            )}
                          </li>
                        ) : null}
                      </ul>
                    ) : null}
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}
    </section>
  )
}
