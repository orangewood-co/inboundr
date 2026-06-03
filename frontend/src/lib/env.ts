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
