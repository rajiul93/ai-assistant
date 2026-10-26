import { describe, expect, it } from "vitest";
import { divisionRemainder, evaluate, formatResult, toFraction, toLatex } from "./calculator";

const calc = (input: string, mode: "deg" | "rad" = "deg") => formatResult(evaluate(input, mode));

describe("calculator", () => {
  it("does arithmetic with precedence and brackets", () => {
    expect(calc("2+3×4")).toBe("14");
    expect(calc("(2+3)×4")).toBe("20");
    expect(calc("10÷4")).toBe("2.5");
    expect(calc("0.1+0.2")).toBe("0.3");
    expect(calc("−5+2")).toBe("-3");
    expect(calc("2^3^2")).toBe("512");
    expect(calc("-2^2")).toBe("-4");
  });

  it("handles trig in degrees and radians", () => {
    expect(calc("sin(30)")).toBe("0.5");
    expect(calc("cos(60)")).toBe("0.5");
    expect(calc("tan(45)")).toBe("1");
    expect(calc("sin(180)")).toBe("0");
    expect(calc("sin(π÷2)", "rad")).toBe("1");
    expect(calc("asin(0.5)")).toBe("30");
    expect(() => evaluate("tan(90)")).toThrow();
  });

  it("knows roots, logs, constants, factorial and percent", () => {
    expect(calc("√(16)")).toBe("4");
    expect(calc("√16")).toBe("4");
    expect(calc("log(1000)")).toBe("3");
    expect(calc("ln(e)")).toBe("1");
    expect(calc("π")).toBe("3.141592654");
    expect(calc("5!")).toBe("120");
    expect(calc("50%")).toBe("0.5");
    expect(calc("200×15%")).toBe("30");
  });

  it("multiplies implied products", () => {
    expect(calc("2π")).toBe("6.283185307");
    expect(calc("3(4+1)")).toBe("15");
    expect(calc("2sin(30)")).toBe("1");
  });

  it("supports ( ) [ ] { } and checks they match", () => {
    expect(calc("{2×[3+(4−1)]}")).toBe("12");
    expect(calc("[2+3]×2")).toBe("10");
    expect(calc("{(1+1")).toBe("2");
    expect(() => evaluate("[2+3)")).toThrow("বন্ধনী");
    expect(() => evaluate("(2+3]")).toThrow("বন্ধনী");
  });

  it("forgives a missing closing bracket and rejects bad input", () => {
    expect(calc("(2+3")).toBe("5");
    expect(() => evaluate("5÷0")).toThrow("শূন্য");
    expect(() => evaluate("√(−4)")).toThrow();
    expect(() => evaluate("2+")).toThrow();
    expect(() => evaluate("")).toThrow();
  });

  it("gives the quotient and remainder of a whole-number division", () => {
    expect(divisionRemainder("17÷5")).toEqual({ quotient: 3, remainder: 2 });
    expect(divisionRemainder("(100+5)÷7")).toEqual({ quotient: 15, remainder: 0 });
    expect(divisionRemainder("1056÷23")).toEqual({ quotient: 45, remainder: 21 });
    expect(divisionRemainder("2+10÷3")).toBeNull();
    expect(divisionRemainder("10÷4÷2")).toBeNull();
    expect(divisionRemainder("7.5÷2")).toBeNull();
    expect(divisionRemainder("5÷0")).toBeNull();
    expect(divisionRemainder("−17÷5")).toEqual({ quotient: -3, remainder: -2 });
  });

  it("finds fractions for the লব/হর answer", () => {
    expect(toFraction(0.75)).toEqual([3, 4]);
    expect(toFraction(-1 / 3)).toEqual([-1, 3]);
    expect(toFraction(evaluate("1÷7+2÷3"))).toEqual([17, 21]);
    expect(toFraction(4)).toBeNull();
    expect(toFraction(Math.PI)).toBeNull();
  });

  it("draws the expression like a textbook", () => {
    expect(toLatex("3÷4")).toBe("\\dfrac{3}{4}");
    expect(toLatex("(1+2)÷4")).toBe("\\dfrac{1+2}{4}");
    expect(toLatex("8^2")).toBe("{8}^{2}");
    expect(toLatex("√(16)")).toBe("\\sqrt{16}");
    expect(toLatex("8^")).toContain("\\square");
    expect(toLatex("{2×[3")).toBe("\\left\\{2\\times \\left[3\\right.\\right.");
    expect(toLatex("")).toBeNull();
  });
});
