import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });

  it("writes a header row followed by data rows", () => {
    const csv = toCsv([
      { client: "Acme Ltd", total: "1080.00" },
      { client: "Beta LLP", total: "250.00" },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe("client,total");
    expect(lines[1]).toBe("Acme Ltd,1080.00");
    expect(lines[2]).toBe("Beta LLP,250.00");
  });

  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = toCsv([{ client: 'Acme, "The Best" Ltd', total: "100.00" }]);
    expect(csv).toContain('"Acme, ""The Best"" Ltd"');
  });

  it("quotes fields containing newlines", () => {
    const csv = toCsv([{ notes: "line one\nline two", total: "0" }]);
    expect(csv.split("\r\n")).toHaveLength(2); // header + one data row, not split by the embedded \n
    expect(csv).toContain('"line one\nline two"');
  });
});
