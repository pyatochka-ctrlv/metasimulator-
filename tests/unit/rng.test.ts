import { createRng, hashString } from "@/simulation/rng";

describe("seeded rng", () => {
  it("is deterministic for the same seed and keys", () => {
    const a = createRng(42, "x", 1);
    const b = createRng(42, "x", 1);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("differs for different seeds or keys", () => {
    expect(createRng(42, "x").next()).not.toEqual(createRng(43, "x").next());
    expect(createRng(42, "x").next()).not.toEqual(createRng(42, "y").next());
  });

  it("produces sane distributions", () => {
    const r = createRng(7, "dist");
    let sum = 0;
    for (let i = 0; i < 5000; i++) sum += r.binomial(100, 0.2);
    expect(sum / 5000).toBeGreaterThan(18.5);
    expect(sum / 5000).toBeLessThan(21.5);
    let ps = 0;
    for (let i = 0; i < 5000; i++) ps += r.poisson(3);
    expect(ps / 5000).toBeGreaterThan(2.8);
    expect(ps / 5000).toBeLessThan(3.2);
    expect(r.binomial(0, 0.5)).toBe(0);
    expect(r.poisson(0)).toBe(0);
  });

  it("hashString is stable", () => {
    expect(hashString("adlab")).toBe(hashString("adlab"));
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});
