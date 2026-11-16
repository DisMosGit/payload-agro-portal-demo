'use client'

import Image from 'next/image'
import { useEffect, useState, useSyncExternalStore } from 'react'

import { youtubeEmbedUrl, type VideoState } from '@/lib/article-utils'

import styles from '@/app/(frontend)/articles/articles.module.css'

type VideoPreviewProps = {
  fallbackTitle: string
  state: VideoState
}

type Mode = 'error' | 'idle' | 'loading' | 'playing'

const LOAD_TIMEOUT_MS = 8000

// There is no external hydration store to subscribe to; the no-op subscribe
// only lets `useSyncExternalStore` report the server snapshot during SSR and
// the client snapshot after hydration, without a setState-in-effect.
const subscribeToHydration = () => () => {}
const getClientSnapshot = () => true
const getServerSnapshot = () => false

export function VideoPreview({ fallbackTitle, state }: VideoPreviewProps) {
  const [mode, setMode] = useState<Mode>('idle')
  const [posterFailed, setPosterFailed] = useState(false)
  // `data-hydrated` lets the E2E suite wait for React before clicking, so a
  // click cannot fall through to the plain external link.
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot)

  useEffect(() => {
    if (mode !== 'loading') {
      return
    }

    const timer = window.setTimeout(() => {
      setMode('error')
    }, LOAD_TIMEOUT_MS)

    return () => window.clearTimeout(timer)
  }, [mode])

  if (state.kind === 'none') {
    return null
  }

  const title = state.title ?? fallbackTitle
  const hasYouTube = Boolean(state.youtubeId)
  const hasAlternative = Boolean(state.alternativeUrl)
  const playHref = state.externalUrl ?? state.alternativeUrl ?? state.youtubeUrl
  const showPoster = Boolean(state.posterUrl) && !posterFailed
  const showPosterLayer = !hasAlternative || hasYouTube

  const startEmbed = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!hasYouTube) {
      return
    }

    event.preventDefault()
    setMode('loading')
  }

  return (
    <section
      className={styles.videoPanel}
      aria-label="Video"
      data-video-facade
      data-hydrated={hydrated ? 'true' : 'false'}
    >
      <div className={styles.videoStage}>
        {hasYouTube && (mode === 'loading' || mode === 'playing') ? (
          <iframe
            className={styles.videoFrame}
            src={youtubeEmbedUrl(state.youtubeId ?? '')}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onError={() => setMode('error')}
            onLoad={() => setMode('playing')}
          />
        ) : null}

        {!hasYouTube && hasAlternative ? (
          <video
            className={styles.videoFrame}
            controls
            poster={state.posterUrl ?? undefined}
            preload="none"
          >
            <source
              src={state.alternativeUrl ?? undefined}
              type={state.alternativeMimeType ?? 'video/mp4'}
            />
          </video>
        ) : null}

        {showPosterLayer && mode !== 'playing' ? (
          <div className={styles.videoPosterLayer}>
            {showPoster ? (
              <Image
                src={state.posterUrl ?? ''}
                alt={state.posterAlt}
                fill
                sizes="(max-width: 48rem) 100vw, 48rem"
                className={styles.videoPoster}
                onError={() => setPosterFailed(true)}
              />
            ) : (
              <div className={styles.videoPosterPlaceholder}>
                <span>{title}</span>
                <span>Video poster unavailable</span>
              </div>
            )}

            {showPoster ? <div className={styles.videoShade} /> : null}

            {mode === 'loading' ? (
              <p className={styles.videoStatus} role="status">
                Loading the YouTube preview…
              </p>
            ) : null}

            {playHref && (mode === 'idle' || mode === 'error') ? (
              <a
                className={styles.playButton}
                href={playHref}
                onClick={startEmbed}
                aria-label={
                  mode === 'error' ? `Try the video again: ${title}` : `Play video: ${title}`
                }
              >
                {mode === 'error' ? 'Try again' : 'Play video'}
              </a>
            ) : null}
          </div>
        ) : null}

        {state.duration ? (
          <span className={styles.durationBadge} aria-label={`Video duration ${state.duration}`}>
            {state.duration}
          </span>
        ) : null}
      </div>

      <div className={styles.videoFallback}>
        <p className={styles.videoFallbackLead}>
          {hasYouTube
            ? 'YouTube may be blocked or throttled in your region. The article stays available even if the embedded preview does not load.'
            : 'This video uses a direct source that does not require YouTube.'}
        </p>

        {state.issues.length > 0 ? (
          <p className={styles.videoUnavailable} role="status">
            Video unavailable. {state.issues.join(' ')}
          </p>
        ) : null}

        {mode === 'error' ? (
          <p className={styles.videoUnavailable} role="alert">
            The video preview did not load. Use the links below to watch it another way.
          </p>
        ) : null}

        <ul className={styles.videoLinks}>
          {state.externalUrl ? (
            <li>
              <a href={state.externalUrl} target="_blank" rel="noreferrer">
                Watch externally
              </a>
            </li>
          ) : null}
          {state.alternativeUrl ? (
            <li>
              <a href={state.alternativeUrl} target="_blank" rel="noreferrer">
                Open alternative video source
              </a>
            </li>
          ) : null}
          {!state.externalUrl && !state.alternativeUrl && state.youtubeUrl ? (
            <li>
              <a href={state.youtubeUrl} target="_blank" rel="noreferrer">
                Open on YouTube
              </a>
            </li>
          ) : null}
        </ul>
      </div>
    </section>
  )
}
