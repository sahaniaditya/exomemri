'use client'

import styles from './dashboard.module.css'

interface PlayButtonProps {
  onClick?: () => void;
  ariaLabel?: string;
}

/** A modern green play button with a white SVG triangle icon. */
export default function PlayButton({ onClick, ariaLabel = "Play" }: PlayButtonProps) {
  return (
    <button 
      className={styles.playButton} 
      onClick={onClick}
      aria-label={ariaLabel}
    >
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
    </button>
  )
}