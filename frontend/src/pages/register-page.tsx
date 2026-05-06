import { AuthPage } from "@/pages/auth-page"

export function RegisterPage() {
  return (
    <AuthPage
      mode="register"
      eyebrow="Create account"
      title="Start your workspace"
      description="Create an account with email and password, or continue with Google."
      submitLabel="Create account"
      alternatePrompt="Already have an account?"
      alternateLabel="Sign in"
      alternateTo="/login"
    />
  )
}
