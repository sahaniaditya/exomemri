export function Glyph({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className="glyph">
      <circle cx="16" cy="16" r="14.5" stroke="#2C5D4F" />
      <path
        d="M16 1.5v29M1.5 16h29M6 6c6 5 14 5 20 0M6 26c6-5 14-5 20 0M4.2 10.5c7 3.5 16.6 3.5 23.6 0M4.2 21.5c7-3.5 16.6-3.5 23.6 0"
        stroke="#2C5D4F"
        strokeWidth="1"
        opacity=".55"
      />
      <circle cx="16" cy="16" r="2.4" fill="#B5623C" />
    </svg>
  );
}
