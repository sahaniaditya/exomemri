'use client'

/**
 * Landing promo video — muted autoplay so browsers allow it on visit.
 * Drop the file at `frontend/public/videos/promo.mp4`.
 */
import { useEffect, useRef, useState } from 'react'
import styles from './marketing.module.css'

const VIDEO_SRC = '/videos/promo.mp4'

export function DemoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [muted, setMuted] = useState(true)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    void video.play().catch(() => {
      // Autoplay can still be blocked (e.g. low-power mode); user can press play.
    })
  }, [])

  function toggleMute() {
    const video = videoRef.current
    if (!video) return
    const next = !video.muted
    video.muted = next
    setMuted(next)
    if (!next) void video.play().catch(() => {})
  }

  return (
    <div className={`${styles.sec} ${styles.divide} ${styles.demoSec}`} id="demo">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>01</span>
          <span className={styles.label}>See it in action</span>
          <span className={styles.plateline} />
        </div>
        <h2 className={`${styles.serif} ${styles.demoTitle}`}>
          From one click
          <br />
          to lasting <span className={`${styles.it} ${styles.accent}`}>memory.</span>
        </h2>
        <p className={`${styles.dim} ${styles.demoCopy}`}>
          A quick look at how you save what you learn — and get it back when
          you need it.
        </p>
        <div className={styles.demoFrame}>
          <video
            ref={videoRef}
            className={styles.demoVideo}
            src={VIDEO_SRC}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            controls={false}
            aria-label="exomemri product demo"
          />
          <button
            type="button"
            className={styles.demoMuteBtn}
            onClick={toggleMute}
            aria-pressed={!muted}
            aria-label={muted ? 'Unmute video' : 'Mute video'}
          >
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
      </div>
    </div>
  )
}
