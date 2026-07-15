import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, formatMoney, parseMoneyToPence } from "@/lib/money";

describe("computeInvoiceTotals", () => {
  it("sums simple line items with no discount or tax", () => {
    const totals = computeInvoiceTotals(
      [
        { quantity: 2, unitPricePence: 5000 },
        { quantity: 1, unitPricePence: 2500 },
      ],
      { discountType: "none", discountValue: 0, taxRatePercent: 0 }
    );
    expect(totals).toEqual({
      subtotalPence: 12500,
      discountPence: 0,
      taxPence: 0,
      totalPence: 12500,
    });
  });

  it("applies UK-style 20% VAT after a percentage discount", () => {
    const totals = computeInvoiceTotals([{ quantity: 1, unitPricePence: 100000 }], {
      discountType: "percent",
      discountValue: 10,
      taxRatePercent: 20,
    });
    // 1000.00 - 10% (100.00) = 900.00 taxable, +20% VAT (180.00) = 1080.00
    expect(totals.subtotalPence).toBe(100000);
    expect(totals.discountPence).toBe(10000);
    expect(totals.taxPence).toBe(18000);
    expect(totals.totalPence).toBe(108000);
  });

  it("applies a fixed-pence discount", () => {
    const totals = computeInvoiceTotals([{ quantity: 1, unitPricePence: 10000 }], {
      discountType: "fixed",
      discountValue: 1500,
      taxRatePercent: 0,
    });
    expect(totals.discountPence).toBe(1500);
    expect(totals.totalPence).toBe(8500);
  });

  it("never lets a discount exceed the subtotal (no negative totals)", () => {
    const totals = computeInvoiceTotals([{ quantity: 1, unitPricePence: 1000 }], {
      discountType: "fixed",
      discountValue: 999999,
      taxRatePercent: 0,
    });
    expect(totals.discountPence).toBe(1000);
    expect(totals.totalPence).toBe(0);
  });

  it("rounds fractional pence to the nearest whole penny", () => {
    // 3 units at a unit price that produces a fractional line total
    const totals = computeInvoiceTotals([{ quantity: 3, unitPricePence: 333 }], {
      discountType: "none",
      discountValue: 0,
      taxRatePercent: 17.5,
    });
    expect(Number.isInteger(totals.subtotalPence)).toBe(true);
    expect(Number.isInteger(totals.taxPence)).toBe(true);
    expect(Number.isInteger(totals.totalPence)).toBe(true);
  });

  it("ignores negative or non-finite inputs defensively", () => {
    const totals = computeInvoiceTotals([{ quantity: 1, unitPricePence: 5000 }], {
      discountType: "percent",
      discountValue: -50,
      taxRatePercent: Number.NaN,
    });
    expect(totals.discountPence).toBe(0);
    expect(totals.taxPence).toBe(0);
    expect(totals.totalPence).toBe(5000);
  });
});

describe("formatMoney", () => {
  it("formats pence as GBP currency", () => {
    expect(formatMoney(108000, "GBP")).toBe("£1,080.00");
  });

  it("formats zero correctly", () => {
    expect(formatMoney(0, "GBP")).toBe("£0.00");
  });
});

describe("parseMoneyToPence", () => {
  it("parses a comma-formatted amount into pence", () => {
    expect(parseMoneyToPence("1,234.50")).toBe(123450);
  });

  it("returns 0 for garbage input instead of throwing", () => {
    expect(parseMoneyToPence("not a number")).toBe(0);
  });
});
