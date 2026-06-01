import { describe, expect, it } from "vitest";
import {
  computeNextChargeDate,
  monthlyEquivalent,
  summarizeSubscriptions
} from "../netlify/functions/lib/subscription-math.mjs";

describe("subscription math", () => {
  it("normalizes monthly equivalent", () => {
    expect(monthlyEquivalent(1200, "annual")).toBe(100);
    expect(monthlyEquivalent(20, "bi_monthly")).toBe(10);
  });

  it("calculates next charge date correctly", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(computeNextChargeDate("2026-05-15", "monthly", now)).toBe("2026-06-15");
    expect(computeNextChargeDate("2026-04-20", "bi_monthly", now)).toBe("2026-06-20");
    expect(computeNextChargeDate("2025-12-01", "annual", now)).toBe("2026-12-01");
  });

  it("builds summary with inr conversion and upcoming charge", () => {
    const result = summarizeSubscriptions(
      [
        {
          id: "a",
          name: "netflix",
          amount: 999,
          currency: "INR",
          billing_period: "monthly",
          start_date: "2026-01-10",
          remarks: ""
        },
        {
          id: "b",
          name: "hosting",
          amount: 120,
          currency: "USD",
          billing_period: "annual",
          start_date: "2025-07-02",
          remarks: ""
        }
      ],
      { USD: 80, GBP: 100, INR: 1 },
      new Date("2026-06-01T00:00:00Z")
    );

    expect(result.summary.monthlyInr).toBe(1799);
    expect(result.summary.annualInr).toBe(21588);
    expect(result.summary.upcoming.name).toBe("netflix");
  });
});

