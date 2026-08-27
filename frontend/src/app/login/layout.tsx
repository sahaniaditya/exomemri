// app/login/layout.tsx — pass-through; auth redirect lives on the page so
// allowlisted ?next=/s/... return paths can be honored.
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
