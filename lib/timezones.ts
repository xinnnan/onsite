export type TimeZoneOption = { value: string; label: string; group: string };

export const TIME_ZONE_OPTIONS: TimeZoneOption[] = [
  { value: "America/New_York", label: "Eastern Time", group: "United States" },
  { value: "America/Chicago", label: "Central Time", group: "United States" },
  { value: "America/Denver", label: "Mountain Time", group: "United States" },
  { value: "America/Phoenix", label: "Arizona", group: "United States" },
  { value: "America/Los_Angeles", label: "Pacific Time", group: "United States" },
  { value: "America/Anchorage", label: "Alaska", group: "United States" },
  { value: "Pacific/Honolulu", label: "Hawaii", group: "United States" },
  { value: "America/Detroit", label: "Detroit", group: "United States" },
  { value: "America/Indiana/Indianapolis", label: "Indiana · Indianapolis", group: "United States" },
  { value: "America/Kentucky/Louisville", label: "Kentucky · Louisville", group: "United States" },
  { value: "America/Boise", label: "Idaho · Boise", group: "United States" },
  { value: "America/Toronto", label: "Toronto", group: "Canada & Mexico" },
  { value: "America/Vancouver", label: "Vancouver", group: "Canada & Mexico" },
  { value: "America/Edmonton", label: "Edmonton", group: "Canada & Mexico" },
  { value: "America/Winnipeg", label: "Winnipeg", group: "Canada & Mexico" },
  { value: "America/Halifax", label: "Halifax", group: "Canada & Mexico" },
  { value: "America/St_Johns", label: "St. John's", group: "Canada & Mexico" },
  { value: "America/Mexico_City", label: "Mexico City", group: "Canada & Mexico" },
  { value: "America/Tijuana", label: "Tijuana", group: "Canada & Mexico" },
  { value: "America/Sao_Paulo", label: "São Paulo", group: "Latin America" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires", group: "Latin America" },
  { value: "America/Bogota", label: "Bogotá", group: "Latin America" },
  { value: "America/Lima", label: "Lima", group: "Latin America" },
  { value: "America/Santiago", label: "Santiago", group: "Latin America" },
  { value: "Europe/London", label: "London", group: "Europe" },
  { value: "Europe/Dublin", label: "Dublin", group: "Europe" },
  { value: "Europe/Paris", label: "Paris", group: "Europe" },
  { value: "Europe/Berlin", label: "Berlin", group: "Europe" },
  { value: "Europe/Madrid", label: "Madrid", group: "Europe" },
  { value: "Europe/Rome", label: "Rome", group: "Europe" },
  { value: "Europe/Amsterdam", label: "Amsterdam", group: "Europe" },
  { value: "Europe/Warsaw", label: "Warsaw", group: "Europe" },
  { value: "Europe/Athens", label: "Athens", group: "Europe" },
  { value: "Europe/Istanbul", label: "Istanbul", group: "Europe" },
  { value: "Europe/Kyiv", label: "Kyiv", group: "Europe" },
  { value: "Asia/Shanghai", label: "Shanghai / Beijing", group: "Asia" },
  { value: "Asia/Hong_Kong", label: "Hong Kong", group: "Asia" },
  { value: "Asia/Tokyo", label: "Tokyo", group: "Asia" },
  { value: "Asia/Seoul", label: "Seoul", group: "Asia" },
  { value: "Asia/Singapore", label: "Singapore", group: "Asia" },
  { value: "Asia/Kolkata", label: "India", group: "Asia" },
  { value: "Asia/Dubai", label: "Dubai", group: "Asia" },
  { value: "Asia/Bangkok", label: "Bangkok", group: "Asia" },
  { value: "Asia/Jakarta", label: "Jakarta", group: "Asia" },
  { value: "Asia/Manila", label: "Manila", group: "Asia" },
  { value: "Asia/Taipei", label: "Taipei", group: "Asia" },
  { value: "Australia/Sydney", label: "Sydney", group: "Australia & Pacific" },
  { value: "Australia/Melbourne", label: "Melbourne", group: "Australia & Pacific" },
  { value: "Australia/Brisbane", label: "Brisbane", group: "Australia & Pacific" },
  { value: "Australia/Perth", label: "Perth", group: "Australia & Pacific" },
  { value: "Australia/Adelaide", label: "Adelaide", group: "Australia & Pacific" },
  { value: "Pacific/Auckland", label: "Auckland", group: "Australia & Pacific" },
  { value: "Africa/Johannesburg", label: "Johannesburg", group: "Africa" },
  { value: "Africa/Cairo", label: "Cairo", group: "Africa" },
  { value: "Africa/Nairobi", label: "Nairobi", group: "Africa" },
  { value: "UTC", label: "Coordinated Universal Time", group: "UTC" },
];

export function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function safeTimeZone(timeZone: unknown) {
  const value = typeof timeZone === "string" ? timeZone : "UTC";
  return isValidTimeZone(value) ? value : "UTC";
}

type TimeSource = Record<string, unknown> | null | undefined;

function relation(value: unknown) {
  return (Array.isArray(value) ? value[0] : value) as TimeSource;
}

export function getSessionTimeZone(row: TimeSource) {
  const checkInEvent = relation(row?.check_in_event);
  const project = relation(row?.project);
  return safeTimeZone(checkInEvent?.project_timezone_snapshot || project?.timezone || "UTC");
}

function zonedParts(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function localDateKey(value: string | Date, timeZone: string) {
  const parts = zonedParts(value, timeZone);
  if (!parts) return "";
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function toZonedDateTimeLocalInput(value: string | Date | null | undefined, timeZone: string) {
  if (!value) return "";
  const parts = zonedParts(value, timeZone);
  if (!parts) return "";
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function zonedDateTimeToUtc(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const requested = {
    year: Number(match[1]), month: Number(match[2]), day: Number(match[3]),
    hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] || 0),
  };
  const naiveUtc = Date.UTC(requested.year, requested.month - 1, requested.day, requested.hour, requested.minute, requested.second);
  if (!Number.isFinite(naiveUtc)) return null;
  let instant = naiveUtc;
  for (let index = 0; index < 4; index += 1) {
    const actual = zonedParts(new Date(instant), timeZone);
    if (!actual) return null;
    const representedAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
    const next = naiveUtc - (representedAsUtc - instant);
    if (next === instant) break;
    instant = next;
  }
  const actual = zonedParts(new Date(instant), timeZone);
  if (!actual || actual.year !== requested.year || actual.month !== requested.month || actual.day !== requested.day || actual.hour !== requested.hour || actual.minute !== requested.minute || actual.second !== requested.second) return null;
  return new Date(instant);
}

export function formatLocalDate(value: string | Date | null | undefined, timeZone: string, locale = "en-US") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: safeTimeZone(timeZone), year: "numeric", month: "short", day: "2-digit" }).format(date);
}

export function formatLocalTime(value: string | Date | null | undefined, timeZone: string, locale = "en-US") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat(locale, { timeZone: safeTimeZone(timeZone), hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatLocalDateTime(value: string | Date | null | undefined, timeZone: string, locale = "en-US") {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return "—";
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone), year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
}
