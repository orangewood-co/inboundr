function requiredViteOrigin(name: string, value: string | undefined, localDefault: string): string {
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
