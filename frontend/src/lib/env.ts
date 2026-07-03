function requiredViteOrigin(name: string, value: string | undefined, localDefault: string): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;

  if (import.meta.env.PROD) {
    throw new Error(`${name} must be set for production builds`);
  }

  return localDefault;
}

function requiredViteValue(name: string, value: string | undefined, localDefault = ""): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;

  if (import.meta.env.PROD) {
    throw new Error(`${name} must be set for production builds`);
  }

  return localDefault;
}

export const API_ORIGIN = requiredViteOrigin(
  "VITE_API_URL",
  import.meta.env.VITE_API_URL,
  "http://localhost:3000",
);

export function getEmbedOrigin(): string {
  return requiredViteOrigin(
    "VITE_EMBED_URL",
    import.meta.env.VITE_EMBED_URL,
    "http://localhost:5175",
  );
}

// Origin serving form share links (/f/:slug) with OG meta tags. Defaults to
// the API origin until a dedicated subdomain is pointed at the backend.
export function getFormsShareOrigin(): string {
  const value = import.meta.env.VITE_FORMS_SHARE_URL?.trim();
  return value ? value.replace(/\/+$/, "") : API_ORIGIN;
}

export const POSTHOG_PROJECT_TOKEN = requiredViteValue(
  "VITE_POSTHOG_PROJECT_TOKEN",
  import.meta.env.VITE_POSTHOG_PROJECT_TOKEN,
);

export const POSTHOG_HOST = requiredViteOrigin(
  "VITE_POSTHOG_HOST",
  import.meta.env.VITE_POSTHOG_HOST,
  "https://eu.i.posthog.com",
);

export const POSTHOG_ENABLED = Boolean(POSTHOG_PROJECT_TOKEN);
