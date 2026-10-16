import { describe, expect, it } from "vitest";
import { htmlToPlainText, isRichHtml, sanitizeNoteHtml } from "./note-html";

describe("note tables", () => {
  it("keeps a table and Quill's row ids, drops anything unsafe in it", () => {
    const html = '<table onclick="x()" style="color:red"><tbody><tr><td data-row="row-ab12">সাল</td><td data-row="1">ঘটনা</td><td data-row="javascript:1">স্থান</td></tr></tbody></table><img src=x onerror=alert(1)>';
    expect(sanitizeNoteHtml(html)).toBe('<table><tbody><tr><td data-row="row-ab12">সাল</td><td data-row="1">ঘটনা</td><td>স্থান</td></tr></tbody></table>');
  });

  it("reads a table as plain text rows", () => {
    const html = "<table><tbody><tr><td>সাল</td><td>ঘটনা</td></tr><tr><td>১৭৪৩</td><td>প্রথম ব্যাকরণ</td></tr></tbody></table>";
    expect(htmlToPlainText(html)).toBe("সাল | ঘটনা\n১৭৪৩ | প্রথম ব্যাকরণ");
    expect(isRichHtml(html)).toBe(true);
  });
});
