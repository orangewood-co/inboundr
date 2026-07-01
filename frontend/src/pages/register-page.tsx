import { Link } from "@tanstack/react-router"

import { AuthHero } from "@/components/auth-hero"
import { SignupForm } from "@/components/signup-form"

export function RegisterPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link to="/" className="flex items-center gap-2 font-medium">
            <img src="/logo-black.png" alt="Inboundr" className="object-contain max-w-30 dark:hidden" />
            <img src="/logo.png" alt="Inboundr" className="hidden object-contain max-w-30 dark:block" />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm />
          </div>
        </div>
      </div>
      <AuthHero />
    </div>
  )
}
