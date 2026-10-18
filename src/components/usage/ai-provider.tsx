"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Loader2, PlugZap, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/user-error";
import { cn } from "@/lib/utils";
import { saveAiSettings, testSavedGemini, type getAiSettingsView } from "@/server/actions/ai-settings";

type View = Awaited<ReturnType<typeof getAiSettingsView>>;

/**
 * Super admin: which AI answers in the app — ChatGPT (OpenAI, as before) or Gemini — and the Gemini
 * key and model. The chosen one answers; if it fails, the other (when it has a key) does.
 */
export function AiProviderSettings({ view }: { view: View }) {
  const router = useRouter();
  const [provider, setProvider] = useState(view.provider);
  const [key, setKey] = useState("");
  const [model, setModel] = useState(view.geminiModel);
  const [pending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const hasKey = Boolean(view.geminiKeyEnding);
  const changed = provider !== view.provider || key.trim() !== "" || model.trim() !== view.geminiModel;

  const save = (removeKey = false) => startTransition(async () => {
    try {
      await saveAiSettings({ provider: removeKey ? "openai" : provider, geminiKey: key.trim() || undefined, geminiModel: model.trim(), removeKey });
      setKey("");
      if (removeKey) setProvider("openai");
      toast.success(removeKey ? "Gemini key মুছে ফেলা হলো — এখন ChatGPT" : key.trim() ? "Key কাজ করছে, সেভ হলো" : "সেভ হলো");
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error, "সেভ করা গেল না।"));
    }
  });

  async function test() {
    setTesting(true);
    try { await testSavedGemini(); toast.success("Gemini ঠিকঠাক উত্তর দিচ্ছে"); } catch (error) { toast.error(errorMessage(error, "Gemini পরীক্ষা করা গেল না।")); } finally { setTesting(false); }
  }

  const option = (id: "openai" | "gemini", title: string, detail: string, disabled: boolean) => <button type="button" role="radio" aria-checked={provider === id} disabled={disabled} onClick={() => setProvider(id)}
    className={cn("flex min-w-0 flex-1 items-start gap-2.5 rounded-2xl p-3 text-left ring-1 transition disabled:opacity-45", provider === id ? "bg-blue-50 ring-2 ring-blue-500" : "bg-white ring-zinc-200 hover:bg-zinc-50")}>
    <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2", provider === id ? "border-blue-600 bg-blue-600 text-white" : "border-zinc-300")}>{provider === id ? <Check className="size-3" strokeWidth={3} /> : null}</span>
    <span className="min-w-0"><span className="block text-sm font-semibold text-zinc-900">{title}</span><span className="block text-xs text-zinc-500">{detail}</span></span>
  </button>;

  return <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5">
    <div className="flex items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-violet-600 text-white"><PlugZap className="size-5" /></span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-zinc-900">কোন AI উত্তর দেবে</h2>
        <p className="text-xs text-zinc-500">যেটা বাছবেন সেটা আগে; সেটা না পারলে অন্যটা (key থাকলে) উত্তর দেবে। Voice আর ছবি সবসময় OpenAI।</p>
      </div>
    </div>

    <div role="radiogroup" aria-label="AI" className="mt-3 flex flex-col gap-2 sm:flex-row">
      {option("openai", "ChatGPT (OpenAI)", view.openaiConfigured ? "আগের মতোই — OPENAI_API_KEY" : "OPENAI_API_KEY সেট করা নেই", false)}
      {option("gemini", "Gemini (Google)", hasKey ? `Key ••••${view.geminiKeyEnding}` : "নিচে key দিন", !hasKey && !key.trim())}
    </div>

    <div className="mt-4 space-y-3 rounded-2xl bg-zinc-50 p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-800"><KeyRound className="size-4" /> Gemini key</p>
      {view.geminiKeyUnreadable ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">সেভ করা key আর পড়া যাচ্ছে না (server-এর secret বদলেছে) — আবার দিন।</p> : null}
      <label className="block space-y-1">
        <span className="text-xs text-zinc-600">{hasKey ? `নতুন key (খালি রাখলে ••••${view.geminiKeyEnding} থাকবে)` : "API key — Google AI Studio থেকে"}</span>
        <input type="password" value={key} onChange={(event) => setKey(event.target.value)} autoComplete="off" spellCheck={false} placeholder="Google AI Studio-র key" className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-sm outline-none focus:border-zinc-400" />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-zinc-600">Model (খালি রাখলে {view.defaultModel})</span>
        <input value={model} onChange={(event) => setModel(event.target.value)} autoComplete="off" spellCheck={false} placeholder={view.defaultModel} className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 font-mono text-sm outline-none focus:border-zinc-400" />
      </label>
      <p className="text-xs text-zinc-500">সেভ করার আগে key একবার পরীক্ষা করা হয়। Key encrypt করে রাখা হয়, পাতায় কখনো দেখানো হয় না।</p>
    </div>

    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => save()} disabled={pending || !changed} className="flex h-10 items-center gap-1.5 rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white disabled:opacity-50">{pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} সেভ করো</button>
      {hasKey ? <button type="button" onClick={() => void test()} disabled={testing || pending} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50 disabled:opacity-50">{testing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Gemini পরীক্ষা করো</button> : null}
      {hasKey ? <button type="button" onClick={() => { if (window.confirm("Gemini key মুছে ফেলবেন? AI আবার ChatGPT-তে চলবে।")) save(true); }} disabled={pending} className="ml-auto flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-4" /> Key মুছো</button> : null}
    </div>
  </section>;
}
