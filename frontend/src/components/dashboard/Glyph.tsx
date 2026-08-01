export default function Glyph({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <circle cx="50" cy="50" r="42" fill="none" stroke="#2C5D4F" strokeWidth="5" />
      <path
        d="M50 8v84M8 50h84M38 21c18 15 42 15 60 0M38 79c18-15 42-15 60 0"
        stroke="#2C5D4F"
        strokeWidth="3.4"
        opacity=".5"
        fill="none"
      />
      <circle cx="50" cy="50" r="7" fill="#B5623C" />
    </svg>
  )
}
