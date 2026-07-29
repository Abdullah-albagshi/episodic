/**
 * Always format calendar dates with the Gregorian calendar, even when the
 * device locale defaults to Islamic/Hijri (common on Arabic-region phones).
 */

function localeWithGregory(): string {
  let base = "en";
  try {
    base = Intl.DateTimeFormat().resolvedOptions().locale || "en";
  } catch {
    // ignore
  }
  // Unicode extension forces Gregorian regardless of region defaults.
  const bare = base.split("-u-")[0];
  return `${bare}-u-ca-gregory`;
}

/** Local YYYY-MM-DD from an epoch-ms timestamp (Gregorian). */
export function formatDateYmd(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** e.g. "March 2024" — for "member since" style labels. */
export function formatMonthYear(ms: number): string {
  return new Date(ms).toLocaleDateString(localeWithGregory(), {
    month: "long",
    year: "numeric",
  });
}

/** e.g. "Mon, Mar 15" — upcoming air dates. */
export function formatShortWeekdayDate(isoDate: string): string {
  return new Date(isoDate + "T00:00:00").toLocaleDateString(localeWithGregory(), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
