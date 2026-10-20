import { describe, expect, it } from "vitest";
import { parsePastedMcqs } from "./question-bank";

describe("parsePastedMcqs", () => {
  it("reads questions with solution and explanation, options on one line or many", () => {
    const { items, failed } = parsePastedMcqs([
      "১. ‘পরমেশ’ শব্দের সন্ধি বিচ্ছেদ কোনটি?",
      "ক) পরম + এশ  খ) পরম + ঈশ  গ) পরম + ইশ  ঘ) পরম + ঈশা",
      "উত্তর: খ",
      "সমাধান: অ + ঈ = এ",
      "১. পরম",
      "২. ঈশ",
      "ব্যাখ্যা: স্বরসন্ধি।",
      "",
      "২. বাংলাদেশের রাজধানী?",
      "ক) ঢাকা",
      "খ) চট্টগ্রাম",
      "গ) খুলনা",
      "ঘ) রাজশাহী",
      "ঙ) সিলেট",
      "উত্তর: ঢাকা",
    ].join("\n"));
    expect(failed).toEqual([]);
    expect(items).toEqual([
      { text: "‘পরমেশ’ শব্দের সন্ধি বিচ্ছেদ কোনটি?", options: ["পরম + এশ", "পরম + ঈশ", "পরম + ইশ", "পরম + ঈশা"], correctIndex: 1, solution: "অ + ঈ = এ\n১. পরম\n২. ঈশ", explanation: "স্বরসন্ধি।" },
      { text: "বাংলাদেশের রাজধানী?", options: ["ঢাকা", "চট্টগ্রাম", "খুলনা", "রাজশাহী", "সিলেট"], correctIndex: 0, solution: null, explanation: null },
    ]);
  });

  it("splits unnumbered questions at a blank line after the answer", () => {
    const { items, failed } = parsePastedMcqs("এক?\nক) a খ) b গ) c ঘ) d\nউত্তর: (ঘ)\n\nদুই?\nক) ১ খ) ২ গ) ৩ ঘ) ৪\nসঠিক উত্তর: গ) ৩");
    expect(failed).toEqual([]);
    expect(items.map((item) => item.correctIndex)).toEqual([3, 2]);
  });

  it("reports questions that don't fit instead of guessing", () => {
    const { items, failed } = parsePastedMcqs("১. কোনটি?\nক) a খ) b গ) c\nউত্তর: ক\n\n২. কোনটি?\nক) a খ) b গ) c ঘ) d\nউত্তর: চ\n\n৩. ঠিক?\nক) a খ) b গ) c ঘ) d\nউত্তর: ক\nএলোমেলো লাইন");
    expect(items).toEqual([]);
    expect(failed).toEqual([1, 2, 3]);
  });
});
