import { describe, expect, it } from "vitest";
import { cleanSolution, solutionToHtml, stripCitations } from "./solution-html";

describe("solutions", () => {
  it("shows older plain text one paragraph per line, with markdown bullets as real ones", () => {
    expect(solutionToHtml("প্রথম ধাপ\n\n* দ্বিতীয়")).toBe("<p>প্রথম ধাপ</p><p>• দ্বিতীয়</p>");
  });

  it("shows HTML as written", () => {
    const html = "<h3>সাল ও ইতিহাস</h3><ul><li>১৯৫২: ভাষা আন্দোলন</li></ul>";
    expect(solutionToHtml(html)).toBe(html);
  });

  it("saves plain text as written and sanitizes HTML", () => {
    expect(cleanSolution("  ∴ উত্তর: ৪  ")).toBe("∴ উত্তর: ৪");
    expect(cleanSolution('<p onclick="x()">মূল কথা</p><script>alert(1)</script>')).toBe("<p>মূল কথা</p>");
  });

  it("drops the sources web search adds inline", () => {
    const html = '<p>শেরেবাংলা নগরে অবস্থিত। ([parliament.gov.bd](https://www.parliament.gov.bd/about/history?utm_source=openai))</p><table><tbody><tr><td>১৯৮৩</td></tr></tbody></table><p>([moma.org](https://www.moma.org/collection/works/82367?utm_source=openai))</p><ul><li>আটটি প্রাঙ্গণ <a href="https://the.akdn/x">the.akdn</a></li><li>দেখো <a href="https://x.org">এই ভবন</a></li></ul>';
    expect(stripCitations(html)).toBe("<p>শেরেবাংলা নগরে অবস্থিত।</p><table><tbody><tr><td>১৯৮৩</td></tr></tbody></table><ul><li>আটটি প্রাঙ্গণ</li><li>দেখো এই ভবন</li></ul>");
  });

  it("treats an empty editor as no solution", () => {
    expect(cleanSolution("<p><br></p>")).toBeNull();
    expect(cleanSolution("   ")).toBeNull();
    expect(cleanSolution(null)).toBeNull();
  });
});
