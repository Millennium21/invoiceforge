import type { RecurrenceInterval } from "@/types";

export interface RecurringTemplateForForecast {
  totalPence: number;
  interval: RecurrenceInterval;
  nextInvoiceDate: string; // YYYY-MM-DD
  recurrenceEndDate: string | null;
}

export interface ForecastMonth {
  monthKey: string; // YYYY-MM
  recurringPence: number;
  projectedAdditionalPence: number;
  totalPence: number;
}

/**
 * Splits a revenue forecast into two honestly-different bands rather than
 * one blended number:
 *
 *  - `recurringPence`: revenue from *known* active recurring invoices,
 *    simulated forward month by month. This is as close to "committed"
 *    as a freelance business gets.
 *  - `projectedAdditionalPence`: a flat trailing-average of historical
 *    one-off revenue, projected forward. This is explicitly a guess, not
 *    a commitment — a real forecasting model would trend/seasonal-adjust
 *    this, but a flat average is honest about its own uncertainty in a
 *    way a fancier-looking model that's equally uncertain underneath
 *    would not be.
 *
 * `fromDate` is a required parameter (not read from `new Date()`
 * internally) so this stays a pure function — the caller supplies "now".
 */
export function computeRevenueForecast(
  recurringTemplates: RecurringTemplateForForecast[],
  historicalMonthlyPence: number[],
  monthsAhead: number,
  fromDate: Date
): ForecastMonth[] {
  const months: ForecastMonth[] = [];
  const startYear = fromDate.getUTCFullYear();
  const startMonth = fromDate.getUTCMonth(); // 0-indexed

  const trailingAveragePence =
    historicalMonthlyPence.length > 0
      ? Math.round(historicalMonthlyPence.reduce((a, b) => a + b, 0) / historicalMonthlyPence.length)
      : 0;

  for (let i = 0; i < monthsAhead; i++) {
    const targetDate = new Date(Date.UTC(startYear, startMonth + i, 1));
    const monthKey = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({ monthKey, recurringPence: 0, projectedAdditionalPence: trailingAveragePence, totalPence: 0 });
  }

  const monthIndexByKey = new Map(months.map((m, i) => [m.monthKey, i]));

  for (const template of recurringTemplates) {
    let cursor = parseIsoDate(template.nextInvoiceDate);
    const end = template.recurrenceEndDate ? parseIsoDate(template.recurrenceEndDate) : null;
    // Cap iterations defensively — a weekly template over a long forecast
    // window should never be able to spin this loop unboundedly.
    const maxIterations = 500;

    for (let iter = 0; iter < maxIterations; iter++) {
      if (end && cursor.getTime() > end.getTime()) break;

      const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;
      const idx = monthIndexByKey.get(key);
      if (idx === undefined) {
        // Past the forecast window entirely — safe to stop once we're
        // beyond the last month rather than scanning further.
        const lastMonth = months[months.length - 1];
        if (lastMonth && key > lastMonth.monthKey) break;
      } else {
        months[idx].recurringPence += template.totalPence;
      }

      cursor = advanceByInterval(cursor, template.interval);
    }
  }

  for (const month of months) {
    month.totalPence = month.recurringPence + month.projectedAdditionalPence;
  }

  return months;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function advanceByInterval(date: Date, interval: RecurrenceInterval): Date {
  const d = new Date(date.getTime());
  switch (interval) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
  }
  return d;
}
