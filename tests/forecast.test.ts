import { describe, expect, it } from "vitest";
import { computeRevenueForecast } from "@/lib/forecast";

describe("computeRevenueForecast", () => {
  const fromDate = new Date(Date.UTC(2026, 0, 15)); // fixed date for determinism

  it("returns all-zero months when there's no data at all", () => {
    const months = computeRevenueForecast([], [], 3, fromDate);
    expect(months.map((m) => m.monthKey)).toEqual(["2026-01", "2026-02", "2026-03"]);
    for (const m of months) {
      expect(m.recurringPence).toBe(0);
      expect(m.projectedAdditionalPence).toBe(0);
      expect(m.totalPence).toBe(0);
    }
  });

  it("projects a flat trailing average of historical revenue forward", () => {
    const months = computeRevenueForecast([], [100000, 200000, 300000], 2, fromDate);
    expect(months[0].projectedAdditionalPence).toBe(200000);
    expect(months[1].projectedAdditionalPence).toBe(200000);
    expect(months[0].recurringPence).toBe(0);
    expect(months[0].totalPence).toBe(200000);
  });

  it("counts a monthly recurring template once per month", () => {
    const months = computeRevenueForecast(
      [{ totalPence: 50000, interval: "monthly", nextInvoiceDate: "2026-01-15", recurrenceEndDate: null }],
      [],
      3,
      fromDate
    );
    expect(months.map((m) => m.recurringPence)).toEqual([50000, 50000, 50000]);
  });

  it("stops counting a recurring template after its recurrenceEndDate", () => {
    const months = computeRevenueForecast(
      [{ totalPence: 50000, interval: "monthly", nextInvoiceDate: "2026-01-15", recurrenceEndDate: "2026-02-28" }],
      [],
      4,
      fromDate
    );
    expect(months.map((m) => m.recurringPence)).toEqual([50000, 50000, 0, 0]);
  });

  it("sums multiple occurrences of a weekly template landing in the same month", () => {
    const months = computeRevenueForecast(
      [{ totalPence: 10000, interval: "weekly", nextInvoiceDate: "2026-01-01", recurrenceEndDate: null }],
      [],
      1,
      fromDate
    );
    // Jan 2026: occurrences on 1, 8, 15, 22, 29 => 5 within the month
    expect(months[0].recurringPence).toBe(50000);
  });

  it("combines recurring and projected-additional into totalPence", () => {
    const months = computeRevenueForecast(
      [{ totalPence: 50000, interval: "monthly", nextInvoiceDate: "2026-01-15", recurrenceEndDate: null }],
      [100000],
      1,
      fromDate
    );
    expect(months[0].recurringPence).toBe(50000);
    expect(months[0].projectedAdditionalPence).toBe(100000);
    expect(months[0].totalPence).toBe(150000);
  });

  it("sums multiple concurrent recurring templates in the same month", () => {
    const months = computeRevenueForecast(
      [
        { totalPence: 50000, interval: "monthly", nextInvoiceDate: "2026-01-15", recurrenceEndDate: null },
        { totalPence: 30000, interval: "monthly", nextInvoiceDate: "2026-01-01", recurrenceEndDate: null },
      ],
      [],
      1,
      fromDate
    );
    expect(months[0].recurringPence).toBe(80000);
  });
});
