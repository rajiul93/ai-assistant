"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { lastPage, PAGE_LIMITS } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/** Page numbers to show: first, last, and a couple around the current one, with gaps as null. */
function pageList(page: number, pages: number) {
  const wanted = new Set([1, pages, page - 1, page, page + 1].filter((value) => value >= 1 && value <= pages));
  const sorted = [...wanted].sort((a, b) => a - b);
  const list: Array<number | null> = [];
  sorted.forEach((value, index) => {
    if (index && value - sorted[index - 1] > 1) list.push(null);
    list.push(value);
  });
  return list;
}

/**
 * Pagination that lives in the URL (?page=&limit=), so reloading or sharing keeps the same page.
 * Changing the page size goes back to page 1.
 */
export function Pagination({ page, limit, total, label = "items" }: { page: number; limit: number; total: number; label?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pages = lastPage(total, limit);
  const go = (next: { page?: number; limit?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.limit !== undefined) { params.set("limit", String(next.limit)); params.delete("page"); }
    if (next.page !== undefined) { if (next.page <= 1) params.delete("page"); else params.set("page", String(next.page)); }
    router.push(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  const button = "flex size-9 items-center justify-center rounded-lg text-sm font-medium transition disabled:opacity-30";

  return <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-2 text-sm">
    <p className="text-xs text-zinc-500 tabular-nums">{from}–{to} of {total} {label}</p>
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => go({ page: page - 1 })} disabled={page <= 1} aria-label="Previous page" className={cn(button, "hover:bg-zinc-100")}><ChevronLeft className="size-4" /></button>
      {pageList(page, pages).map((value, index) => value === null
        ? <span key={`gap-${index}`} className="px-1 text-zinc-400">…</span>
        : <button key={value} type="button" onClick={() => go({ page: value })} aria-current={value === page ? "page" : undefined} className={cn(button, "tabular-nums", value === page ? "bg-zinc-950 text-white" : "hover:bg-zinc-100")}>{value}</button>)}
      <button type="button" onClick={() => go({ page: page + 1 })} disabled={page >= pages} aria-label="Next page" className={cn(button, "hover:bg-zinc-100")}><ChevronRight className="size-4" /></button>
      <label className="ml-1 flex items-center gap-1 text-xs text-zinc-500">
        <span className="sr-only">Per page</span>
        <select value={limit} onChange={(event) => go({ limit: Number(event.target.value) })} className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-800">
          {PAGE_LIMITS.map((option) => <option key={option} value={option}>{option} / page</option>)}
        </select>
      </label>
    </div>
  </nav>;
}
