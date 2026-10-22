import { describe, expect, it } from "vitest";
import { allFactors, hcfLadder, lcmLadder, parseNumbers, powersOf, primeFactorLadder } from "./lcm-hcf";

describe("lcmLadder", () => {
  it("matches the book example 16, 24, 30, 36, 48", () => {
    const ladder = lcmLadder([16, 24, 30, 36, 48]);
    expect(ladder.steps.map((step) => step.divisor)).toEqual([2, 2, 2, 2, 3]);
    expect(ladder.steps.map((step) => step.row)).toEqual([
      [16, 24, 30, 36, 48],
      [8, 12, 15, 18, 24],
      [4, 6, 15, 9, 12],
      [2, 3, 15, 9, 6],
      [1, 3, 15, 9, 3],
    ]);
    expect(ladder.last).toEqual([1, 1, 5, 3, 1]);
    expect(ladder.factors).toEqual([2, 2, 2, 2, 3, 5, 3]);
    expect(ladder.result).toBe(720);
  });

  it("matches the book example 12, 18", () => {
    const ladder = lcmLadder([12, 18]);
    expect(ladder.factors).toEqual([2, 3, 2, 3]);
    expect(ladder.result).toBe(36);
  });

  it("numbers with nothing in common multiply", () => expect(lcmLadder([7, 9]).result).toBe(63));
});

describe("hcfLadder", () => {
  it("12, 18 → 6", () => {
    const ladder = hcfLadder([12, 18]);
    expect(ladder.factors).toEqual([2, 3]);
    expect(ladder.last).toEqual([2, 3]);
    expect(ladder.result).toBe(6);
  });
  it("divides only by primes common to all", () => expect(hcfLadder([16, 24, 30, 36, 48]).result).toBe(2));
  it("no common prime → 1", () => {
    const ladder = hcfLadder([7, 9]);
    expect(ladder.steps).toEqual([]);
    expect(ladder.result).toBe(1);
  });
});

describe("parseNumbers", () => {
  it("reads Bangla and English digits, commas and spaces", () => expect(parseNumbers("১২, 18 ২৪")).toEqual([12, 18, 24]));
  it("one number is allowed, none is not", () => {
    expect(parseNumbers("৩৬")).toEqual([36]);
    expect(() => parseNumbers("  ")).toThrow();
  });
  it("refuses zero and fractions", () => {
    expect(() => parseNumbers("0, 5")).toThrow();
    expect(() => parseNumbers("1.5, 3")).toThrow();
  });
});

describe("large primes", () => {
  it("stays fast and correct", () => {
    const started = Date.now();
    expect(lcmLadder([999983, 999979]).result).toBe(999983 * 999979);
    expect(hcfLadder([999983, 999979]).result).toBe(1);
    expect(Date.now() - started).toBeLessThan(100);
  });
});

describe("primeFactorLadder", () => {
  it("36 → 2 × 2 × 3 × 3, the last prime as the bottom row", () => {
    const ladder = primeFactorLadder(36);
    expect(ladder.steps.map((step) => [step.divisor, step.row[0]])).toEqual([[2, 36], [2, 18], [3, 9]]);
    expect(ladder.last).toEqual([3]);
    expect(ladder.factors).toEqual([2, 2, 3, 3]);
    expect(powersOf(ladder.factors)).toEqual([[2, 2], [3, 2]]);
  });
  it("a prime has no steps", () => {
    const ladder = primeFactorLadder(13);
    expect(ladder.steps).toEqual([]);
    expect(ladder.factors).toEqual([13]);
  });
  it("1 has no prime factors", () => expect(primeFactorLadder(1).factors).toEqual([]));
  it("lists every factor in order", () => expect(allFactors(36)).toEqual([1, 2, 3, 4, 6, 9, 12, 18, 36]));
});
