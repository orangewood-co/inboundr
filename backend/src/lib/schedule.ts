const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function normalizeTime(value: unknown, fallback = "08:00"): string {
  const time = String(value ?? "").trim();
  return TIME_RE.test(time) ? time : fallback;
}

export function normalizeTimezone(value: unknown): string {
  const timezone = String(value ?? "").trim();
  if (!timezone) return "UTC";

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

export function sendHourUtcFromLocal(sendTimeLocal: string, timezone: string): number {
  const [hour, minute] = sendTimeLocal.split(":").map(Number);
  const now = new Date();
  const utcGuess = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(utcGuess);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute)
  );
  const offsetMs = localAsUtc - utcGuess.getTime();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute) - offsetMs).getUTCHours();
}
