import { describe, expect, it } from "vitest";
import { repairLatexInJson } from "./ai-json";

const parse = (raw: string) => JSON.parse(repairLatexInJson(raw)) as { reply: string };

describe("repairLatexInJson", () => {
  it("keeps LaTeX that JSON would eat or reject", () => {
    expect(parse(String.raw`{"reply":"Z: $\frac{4ab}{1}$"}`).reply).toBe(String.raw`Z: $\frac{4ab}{1}$`);
    expect(parse(String.raw`{"reply":"$a\times b$, $\theta$, $\right)$, $\beta$"}`).reply).toBe(String.raw`$a\times b$, $\theta$, $\right)$, $\beta$`);
    expect(parse(String.raw`{"reply":"$\sqrt{2}$ ও $\cdot$ ও $\left($ ও $\underline{x}$"}`).reply).toBe(String.raw`$\sqrt{2}$ ও $\cdot$ ও $\left($ ও $\underline{x}$`);
    expect(parse(String.raw`{"reply":"$a \neq b$"}`).reply).toBe(String.raw`$a \neq b$`);
  });

  it("leaves real JSON escapes alone", () => {
    expect(parse(String.raw`{"reply":"এক\nদুই\tতিন \"উদ্ধৃতি\" \\ A"}`).reply).toBe('এক\nদুই\tতিন "উদ্ধৃতি" \\ A');
    expect(parse(String.raw`{"reply":"$\\frac{1}{2}$"}`).reply).toBe(String.raw`$\frac{1}{2}$`);
    expect(parse(String.raw`{"reply":"line\nThen"}`).reply).toBe("line\nThen");
  });
});
