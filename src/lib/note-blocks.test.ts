import { describe, expect, it } from "vitest";
import { applyBlockEdits, splitBlocks } from "./note-blocks";

const note = '<h2>শিরোনাম</h2><p>এক <strong>মোটা</strong></p><ol><li data-list="bullet">ক</li><li>খ</li></ol><table><tbody><tr><td>১</td><td>২</td></tr></tbody></table><p><br></p>';

describe("note blocks", () => {
  it("splits a note into its top-level blocks", () => {
    expect(splitBlocks(note)).toEqual(["<h2>শিরোনাম</h2>", "<p>এক <strong>মোটা</strong></p>", '<ol><li data-list="bullet">ক</li><li>খ</li></ol>', "<table><tbody><tr><td>১</td><td>২</td></tr></tbody></table>", "<p><br></p>"]);
    expect(splitBlocks("")).toEqual([]);
    expect(splitBlocks('<p>যদি <span class="ql-formula" data-value="a>b"></span> হয়</p><p>পরে</p>')).toEqual(['<p>যদি <span class="ql-formula" data-value="a>b"></span> হয়</p>', "<p>পরে</p>"]);
  });

  it("applies replace, delete and inserts, leaving the rest untouched", () => {
    const blocks = splitBlocks(note);
    const html = applyBlockEdits(blocks, [
      { op: "replace", block: 2, html: "<p>নতুন</p>" },
      { op: "delete", block: 5, html: "" },
      { op: "insert_after", block: 0, html: "<p>শুরু</p>" },
      { op: "insert_after", block: 3, html: "<p>এক</p>" },
      { op: "insert_after", block: 3, html: "<p>দুই</p>" },
      { op: "replace", block: 99, html: "<p>x</p>" },
    ]);
    expect(html).toBe('<p>শুরু</p><h2>শিরোনাম</h2><p>নতুন</p><ol><li data-list="bullet">ক</li><li>খ</li></ol><p>এক</p><p>দুই</p><table><tbody><tr><td>১</td><td>২</td></tr></tbody></table>');
  });

  it("builds an empty note from inserts at the top", () => {
    expect(applyBlockEdits([], [{ op: "insert_after", block: 0, html: "<h2>নতুন</h2>" }])).toBe("<h2>নতুন</h2>");
  });
});
