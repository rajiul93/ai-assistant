import { describe, expect, it } from "vitest";
import { parsePastedMcqs, parsePastedShorts } from "./question-bank";

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

  it("names a question whose answer isn't one of its options", () => {
    const { items, failed } = parsePastedMcqs("1। এক?\nক) a খ) b গ) c ঘ) d\nউত্তর: ক\n\n20। √(x²) = কত?\nক) x   খ) −x   গ) ±x   ঘ) x²\nউত্তর: সঠিক বিকল্প নেই\nসমাধান: |x|");
    expect(items).toHaveLength(1);
    expect(failed).toEqual([{ at: 2, label: "20", line: "√(x²) = কত?" }]);
  });

  it("reports questions that don't fit instead of guessing", () => {
    const { items, failed } = parsePastedMcqs("১. কোনটি?\nক) a খ) b গ) c\nউত্তর: ক\n\n২. কোনটি?\nক) a খ) b গ) c ঘ) d\nউত্তর: চ\n\n৩. ঠিক?\nক) a খ) b গ) c ঘ) d\nউত্তর: ক\nএলোমেলো লাইন");
    expect(items).toEqual([]);
    expect(failed.map((miss) => miss.label)).toEqual(["১", "২", "৩"]);
    expect(failed[0]).toEqual({ at: 1, label: "১", line: "কোনটি?" });
  });
});

describe("parsePastedShorts", () => {
  it("reads numbered questions with multi-line answers, keeping lists inside an answer", () => {
    const { items, failed } = parsePastedShorts("১. বাংলা ভাষার আদি নিদর্শন কী?\nউত্তর: চর্যাপদ\n\n২. সন্ধি কত প্রকার?\nউত্তর: তিন প্রকার—\n১. স্বরসন্ধি\n২. ব্যঞ্জনসন্ধি\n৩. বিসর্গসন্ধি\n৩. রাজধানী?\nউত্তর: ঢাকা");
    expect(failed).toEqual([]);
    expect(items).toEqual([
      { question: "বাংলা ভাষার আদি নিদর্শন কী?", answer: "চর্যাপদ" },
      { question: "সন্ধি কত প্রকার?", answer: "তিন প্রকার—\n১. স্বরসন্ধি\n২. ব্যঞ্জনসন্ধি\n৩. বিসর্গসন্ধি" },
      { question: "রাজধানী?", answer: "ঢাকা" },
    ]);
  });

  it("splits unnumbered questions at a blank line and names ones without an answer", () => {
    expect(parsePastedShorts("এক?\nউত্তর: ১\n\nদুই?\nউত্তর: ২").items).toHaveLength(2);
    const { items, failed } = parsePastedShorts("১. এক?\nউত্তর: ১\n২. দুই?\nউত্তর:");
    expect(items).toHaveLength(1);
    expect(failed).toEqual([{ at: 2, label: "২", line: "দুই?" }]);
  });
});
