import { describe, expect, it } from "vitest";
import { balanceMath, plainMathToLatex } from "./math";

describe("plainMathToLatex", () => {
  it("turns fractions into stacked fractions, in English or Bangla digits", () => {
    expect(plainMathToLatex("উত্তর 1/2")).toBe("উত্তর $\\frac{1}{2}$");
    expect(plainMathToLatex("৩/৪ অংশ")).toBe("$\\frac{৩}{৪}$ অংশ");
    expect(plainMathToLatex("1/2 + 1/3")).toBe("$\\frac{1}{2}$ + $\\frac{1}{3}$");
  });

  it("leaves dates, words with slashes and units alone", () => {
    for (const text of ["১২/০৩/২০২৪", "12/03/2024", "and/or", "60 km/h", "ক/খ"]) expect(plainMathToLatex(text)).toBe(text);
  });

  it("draws roots and powers", () => {
    expect(plainMathToLatex("√3")).toBe("$\\sqrt{3}$");
    expect(plainMathToLatex("√(x+1)")).toBe("$\\sqrt{x+1}$");
    expect(plainMathToLatex("∛8")).toBe("$\\sqrt[3]{8}$");
    expect(plainMathToLatex("x² + y²")).toBe("$x^{2}$ + $y^{2}$");
    expect(plainMathToLatex("10^(n+1)")).toBe("$10^{n+1}$");
    expect(plainMathToLatex("a⁻¹")).toBe("$a^{-1}$");
  });

  it("keeps math that is already written as LaTeX", () => {
    expect(plainMathToLatex("$\\frac{1}{2}$ আর 1/4")).toBe("$\\frac{1}{2}$ আর $\\frac{1}{4}$");
  });

  it("changes nothing in ordinary text", () => {
    const text = "Gulliver's Travels একটি বইয়ের নাম। তাই Verb singular।";
    expect(plainMathToLatex(text)).toBe(text);
  });
});

describe("balanceMath", () => {
  it("puts back a $ the AI dropped", () => {
    expect(balanceMath("\\sqrt{2}$")).toBe("$\\sqrt{2}$");
    expect(balanceMath("* \\sqrt{3}$")).toBe("* $\\sqrt{3}$");
    expect(balanceMath("উত্তর: \\frac{1}{2}$ হবে")).toBe("উত্তর: $\\frac{1}{2}$ হবে");
    expect(balanceMath("$\\sqrt{2} হলে")).toBe("$\\sqrt{2}$ হলে");
    expect(balanceMath("ধরি $x^2")).toBe("ধরি $x^2$");
    expect(balanceMath("$a$ ও \\sqrt{3}$")).toBe("$a$ ও $\\sqrt{3}$");
    expect(balanceMath("Z: $\frac{4ab}{1}$")).toBe("Z: $\\frac{4ab}{1}$");
  });

  it("leaves money and balanced math alone", () => {
    expect(balanceMath("দাম $5")).toBe("দাম $5");
    expect(balanceMath("$x$ আর $y$")).toBe("$x$ আর $y$");
    expect(balanceMath("$$\\frac{1}{2}$$")).toBe("$$\\frac{1}{2}$$");
  });
});
