import styles from './dashboard.module.css'

export default function ContourBg() {
  return (
    <svg
      className={styles.contour}
      viewBox="0 0 1200 420"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill="none" stroke="#2C5D4F" strokeWidth="1.5" opacity=".55">
        <path d="M0 230C220 160 360 270 600 210 860 150 980 250 1200 190" />
        <path d="M0 270C220 200 360 310 600 250 860 190 980 290 1200 230" />
        <path d="M0 190C240 120 380 230 620 170 860 110 980 210 1200 150" />
        <path d="M0 310C200 250 360 350 600 300 860 245 1000 330 1200 280" />
        <path d="M0 150C260 100 400 190 640 140 900 85 1020 170 1200 120" />
      </g>
    </svg>
  )
}
