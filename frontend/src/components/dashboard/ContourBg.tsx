import styles from './dashboard.module.css'

export default function ContourBg() {
  return (
    <svg
      className={styles.contour}
      viewBox="0 0 1200 340"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill="none" stroke="#2C5D4F" strokeWidth="2" opacity=".5">
        <path d="M0 210C220 150 360 250 600 200 860 146 980 236 1200 180" />
        <path d="M0 250C220 190 360 290 600 240 860 186 980 276 1200 220" />
        <path d="M0 170C240 110 380 210 620 160 860 106 980 196 1200 140" />
      </g>
    </svg>
  )
}
