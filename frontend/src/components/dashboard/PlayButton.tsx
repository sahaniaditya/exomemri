'use client'

import styles from './dashboard.module.css'

interface PlayButtonProps {
  onClick?: () => void;
  ariaLabel?: string;
}

const icon = (
  <svg
    width="18"
    height="20"
    viewBox="0 0 18 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    className={styles.icon}
  >
    <path
      d="M1 18V2C1 1.15789 1.94737 0.657895 2.65789 1.13158L16.1579 9.13158C16.8158 9.52632 16.8158 10.4737 16.1579 10.8684L2.65789 18.8684C1.94737 19.3421 1 18.8421 1 18Z"
      fill="currentColor"
    />
  </svg>
)

/**
 * A modern green play button with a white SVG triangle icon. Renders as a
 * real <button> when it has its own onClick, or as a decorative <span> when
 * it's just a visual affordance inside an already-interactive ancestor (e.g.
 * a card wrapped in a <Link>) — avoids nesting interactive elements.
 */
export default function PlayButton({ onClick, ariaLabel = 'Play' }: PlayButtonProps) {
  if (!onClick) {
    return (
      <span className={styles.playButton} aria-hidden="true">
        {icon}
      </span>
    )
  }

  return (
    <button className={styles.playButton} onClick={onClick} aria-label={ariaLabel}>
      {icon}
    </button>
  )
}