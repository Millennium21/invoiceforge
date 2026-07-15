/**
 * Small, dependency-free CSV writer. A UK-friendly revenue/tax export is
 * a handful of columns and a few dozen rows at most for a freelancer — not
 * worth pulling in a library for. RFC 4180-style quoting: any field
 * containing a comma, quote, or newline gets wrapped in quotes with
 * internal quotes doubled.
 */
export function toCsv(rows: Record<string, string | number>[]): string {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const escapeField = (value: string | number): string => {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.map(escapeField).join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeField(row[h] ?? "")).join(","));
  }
  return lines.join("\r\n");
}
