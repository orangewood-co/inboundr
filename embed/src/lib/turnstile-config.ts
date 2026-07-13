export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim()
export const turnstileIsRequired = Boolean(TURNSTILE_SITE_KEY)
