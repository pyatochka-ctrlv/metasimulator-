import { breakEvenRoas, conversionRate, costPer, cpc, cpm, ctr, dataSufficiency, frequency, impressionsFromSpend, roas, round, safeDiv, twoProportionZTest, wilsonInterval } from "@/simulation/metrics";
import { fmtInt, fmtMoney, fmtPct, DASH } from "@/lib/format";

describe("metric formulas", () => {
  it("computes CPM, CTR, CPC, CPA, ROAS, frequency", () => {
    expect(cpm(200, 100_000)).toBeCloseTo(2, 10);
    expect(ctr(1_000, 50_000)).toBeCloseTo(2, 10);
    expect(cpc(150, 300)).toBeCloseTo(0.5, 10);
    expect(costPer(300, 12)).toBeCloseTo(25, 10);
    expect(roas(840, 300)).toBeCloseTo(2.8, 10);
    expect(frequency(15_000, 10_000)).toBeCloseTo(1.5, 10);
    expect(conversionRate(30, 600)).toBeCloseTo(5, 10);
  });

  it("impressions ≈ spend / CPM × 1000 and is consistent with cpm()", () => {
    const imp = impressionsFromSpend(50, 2.5);
    expect(imp).toBeCloseTo(20_000, 6);
    expect(cpm(50, imp)).toBeCloseTo(2.5, 10);
  });

  it("returns null on division by zero or invalid input", () => {
    expect(safeDiv(1, 0)).toBeNull();
    expect(cpm(10, 0)).toBeNull();
    expect(ctr(0, 0)).toBeNull();
    expect(cpc(10, 0)).toBeNull();
    expect(costPer(10, 0)).toBeNull();
    expect(roas(10, 0)).toBeNull();
    expect(safeDiv(Number.NaN, 2)).toBeNull();
    expect(impressionsFromSpend(10, 0)).toBe(0);
  });

  it("formats missing values as a dash", () => {
    expect(fmtMoney(null)).toBe(DASH);
    expect(fmtPct(Number.POSITIVE_INFINITY)).toBe(DASH);
    expect(fmtInt(undefined)).toBe(DASH);
    expect(fmtMoney(1234.5)).toBe("$1,234.50");
  });

  it("rounds without floating point drift", () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(2.675, 2)).toBe(2.68);
  });

  it("computes break-even ROAS from margin", () => {
    expect(breakEvenRoas(0.45)).toBeCloseTo(2.2222, 3);
    expect(breakEvenRoas(0)).toBeNull();
  });

  it("wilson interval contains the observed rate and is bounded", () => {
    const ci = wilsonInterval(50, 1000)!;
    expect(ci.low).toBeLessThan(5);
    expect(ci.high).toBeGreaterThan(5);
    expect(ci.low).toBeGreaterThanOrEqual(0);
    expect(wilsonInterval(0, 0)).toBeNull();
  });

  it("z-test detects large differences and ignores tiny ones", () => {
    const big = twoProportionZTest(300, 10_000, 150, 10_000)!;
    expect(big.pValue).toBeLessThan(0.001);
    const small = twoProportionZTest(6, 1000, 3, 1000)!;
    expect(small.pValue).toBeGreaterThan(0.05);
  });

  it("classifies data sufficiency", () => {
    expect(dataSufficiency(5)).toBe("insufficient");
    expect(dataSufficiency(30)).toBe("directional");
    expect(dataSufficiency(80)).toBe("reliable");
  });
});
