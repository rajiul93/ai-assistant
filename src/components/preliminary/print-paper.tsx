"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown } from "lucide-react";
import { createPortal } from "react-dom";
import { PaperSheet, type PaperData } from "./paper-sheet";

/**
 * Prints a paper through the browser ("Save as PDF" in its print dialog), so Bangla conjuncts and
 * math come out exactly as on screen and nothing is stored. The sheet is put straight under
 * <body>, where `#paper-print` rules in globals.css hide everything else while printing. The tab
 * title becomes the PDF's file name for that moment.
 */
export function PrintPaper({ paper, onDone }: { paper: PaperData; onDone: () => void }) {
  // Kept in a ref so a parent re-render (a new onDone) doesn't print a second time.
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    const title = document.title;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      document.title = title;
      done.current();
    };
    window.addEventListener("afterprint", finish);
    // Let the sheet and its fonts lay out before the print dialog takes a snapshot.
    const timer = window.setTimeout(() => {
      void document.fonts.ready.then(() => {
        document.title = paper.title;
        window.print();
      });
    }, 50);
    return () => { window.clearTimeout(timer); window.removeEventListener("afterprint", finish); document.title = title; };
  }, [paper]);

  return createPortal(<div id="paper-print"><PaperSheet paper={paper} /></div>, document.body);
}

/** "PDF" on a saved paper's page: prints it the same way. */
export function PaperPdfButton({ paper }: { paper: PaperData }) {
  const [printing, setPrinting] = useState(false);
  return <>
    <button type="button" onClick={() => setPrinting(true)} disabled={printing} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"><FileDown className="size-4" /> PDF</button>
    {printing ? <PrintPaper paper={paper} onDone={() => setPrinting(false)} /> : null}
  </>;
}
