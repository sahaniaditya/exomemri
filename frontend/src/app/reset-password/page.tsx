import ResetPasswordForm from './ResetPasswordForm'

interface ResetPasswordPageProps {
  searchParams: Promise<{ token_hash?: string; type?: string }>
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams
  return (
    <ResetPasswordForm
      tokenHash={params.token_hash ?? null}
      type={params.type ?? null}
    />
  )
}
