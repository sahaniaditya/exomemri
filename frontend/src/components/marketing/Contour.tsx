export function Contour({ style, dark = false }: { style?: React.CSSProperties; dark?: boolean }) {
  const stroke = dark ? '#7FA88C' : '#2C5D4F';
  const opacity = dark ? 0.22 : 0.16;
  return (
    <svg
      className="contour"
      viewBox="0 0 1440 700"
      preserveAspectRatio="xMidYMid slice"
      style={style}
      aria-hidden="true"
    >
      <g fill="none" stroke={stroke} strokeWidth="1" opacity={opacity}>
        <path d="M-50 420C220 300 360 480 640 380 940 272 1120 470 1520 360" />
        <path d="M-50 470C220 350 360 530 640 430 940 322 1120 520 1520 410" />
        <path d="M-50 520C220 400 360 580 640 480 940 372 1120 570 1520 460" />
        <path d="M-50 370C240 260 380 430 660 330 960 222 1120 420 1520 310" />
        <path d="M-50 320C260 220 400 380 680 290 980 190 1120 370 1520 270" />
        <path d="M-50 570C200 460 360 630 640 530 940 422 1120 620 1520 510" />
      </g>
    </svg>
  );
}
