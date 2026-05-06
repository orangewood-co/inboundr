import { AuthPage } from "@/pages/auth-page"

export function RegisterPage() {
  return (
    <AuthPage
      eyebrow="Create account"
      title="Start your workspace"
      description="This dummy registration page stays outside the application shell so you can build auth independently from the sidebar flow."
      submitLabel="Create account"
      alternatePrompt="Already have an account?"
      alternateLabel="Sign in"
      alternateTo="/login"
    />
  )
}
