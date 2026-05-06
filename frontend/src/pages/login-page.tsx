import { AuthPage } from "@/pages/auth-page"

export function LoginPage() {
  return (
    <AuthPage
      eyebrow="Welcome back"
      title="Sign in to continue"
      description="Use this placeholder login screen to enter the product without loading the sidebar layout."
      submitLabel="Sign in"
      alternatePrompt="Need an account?"
      alternateLabel="Create one"
      alternateTo="/register"
    />
  )
}
