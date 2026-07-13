import { AuthLayout } from "@/components/auth-layout"
import { SignupForm } from "@/components/signup-form"

export function RegisterPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  )
}
