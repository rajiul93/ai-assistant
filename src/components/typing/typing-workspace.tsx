"use client";
import { useEffect, useState } from "react";
import { Keyboard, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { banglaLayouts, type TypingLanguage, type TypingMethod } from "@/lib/typing/layouts";
import { cn } from "@/lib/utils";
import { useHardwareKeyboard, useTypingKeyboard } from "@/store/typing-keyboard";
import { TYPE_KEY_EVENT } from "./typing-input";
import { ConjunctPanel, LearnPanel, PracticePanel, ProgressPanel, TestPanel } from "./typing-panels";

const tabs = [
  { id: "learn", label: "Learn", Panel: LearnPanel },
  { id: "practice", label: "Practice", Panel: PracticePanel },
  { id: "conjunct", label: "যুক্তবর্ণ", Panel: ConjunctPanel },
  { id: "test", label: "Typing test", Panel: TestPanel },
  { id: "progress", label: "Progress", Panel: ProgressPanel },
] as const;

const toggle = (active: boolean) =>
  `shrink-0 rounded-full border transition ${active ? "border-emerald-700 bg-emerald-50 font-semibold text-emerald-950" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"}`;
// Phones: one sideways-scrolling row (edge to edge) instead of wrapped lines.
const row = "-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden";

/** Any letter typed while nothing is focused goes to the lesson's typing box (no tap needed). */
function useFocusOnType() {
  const noteKey = useTypingKeyboard((state) => state.noteKey);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement || (active instanceof HTMLElement && active.isContentEditable)) return;
      const box = document.querySelector<HTMLInputElement | HTMLTextAreaElement>("[data-typing-input]:not(:disabled)");
      if (!box) return;
      noteKey(event);
      // The browser does not move a key that is already pressed to a newly focused box,
      // so the box is focused and handed this key itself (TypingInput converts it).
      event.preventDefault();
      box.focus();
      box.dispatchEvent(new CustomEvent(TYPE_KEY_EVENT, { detail: event.key }));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [noteKey]);
}

export function TypingWorkspace() {
  const [language, setLanguage] = useState<TypingLanguage>("bn");
  const [method, setMethod] = useState<TypingMethod>("bijoy-unicode");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("learn");
  const hardware = useHardwareKeyboard();
  const setHardware = useTypingKeyboard((state) => state.setChoice);
  const { Panel } = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const [settingsOpen, setSettingsOpen] = useState(false);
  useFocusOnType();
  useEffect(() => { void useTypingKeyboard.persist.rehydrate(); }, []);

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-emerald-700">PREP / SKILL ROOM 02</p>
          <h1 className="mt-0.5 truncate text-xl font-semibold sm:text-2xl">Typing lab / টাইপিং ল্যাব</h1>
        </div>
        <div className="flex shrink-0 gap-1 rounded-full bg-zinc-100 p-1">
          {([["bn", "বাংলা"], ["en", "English"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setLanguage(id)} aria-pressed={language === id} className={cn("h-8 rounded-full px-3 text-sm font-semibold transition", language === id ? "bg-zinc-900 text-white" : "text-zinc-600")}>{label}</button>
          ))}
        </div>
        {/* Settings (Bijoy variant, plugged-in keyboard) live behind the gear to keep the page clean. */}
        <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Typing settings" title="Settings" className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition hover:bg-zinc-200 active:scale-95">
          <Settings className="size-5" />
          {hardware ? <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-emerald-600 ring-2 ring-white" title="বাইরের কী-বোর্ড চালু"><Keyboard className="size-2.5 text-white" /></span> : null}
        </button>
      </header>

      <div role="tablist" className={row}>
        {tabs.map((tab) => (
          <button key={tab.id} role="tab" onClick={() => setActiveTab(tab.id)} aria-selected={activeTab === tab.id} className={`px-3.5 py-1.5 text-sm ${toggle(activeTab === tab.id)}`}>{tab.label}</button>
        ))}
      </div>

      <Panel key={language} language={language} method={method} />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Typing settings</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">বাংলা typing method</h3>
              <div role="radiogroup" aria-label="বাংলা typing method" className="grid gap-2">
                {banglaLayouts.map((item) => (
                  <button key={item.id} type="button" role="radio" aria-checked={method === item.id} onClick={() => setMethod(item.id)} className={cn("rounded-2xl border px-3 py-2.5 text-left transition", method === item.id ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600" : "border-zinc-200 hover:border-zinc-300")}>
                    <span className="flex items-center justify-between gap-2"><span className="font-semibold">{item.name}</span><span className="text-[11px] text-zinc-500">{item.encoding}</span></span>
                    <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{item.note}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-zinc-500">তিনটিতেই কী-বোর্ড লেআউট একই, তাই এখানে শেখা সব কী সবগুলোতে কাজ করবে।</p>
            </section>

            <section className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-100">
              <Keyboard className="size-5 shrink-0 text-emerald-700" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-950">বাইরের কী-বোর্ড (OTG / Bluetooth)</p>
                <p className="text-xs leading-snug text-emerald-900/80">{hardware ? "চালু — স্ক্রিনের কী-বোর্ড আসবে না, যেকোনো কী চাপলেই টাইপ শুরু।" : "ফোনে কী-বোর্ড লাগালে চালু করো — স্ক্রিনের কী-বোর্ড জায়গা নেবে না। লাগিয়ে কী চাপলে নিজেই চালু হয়।"}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hardware}
                aria-label="বাইরের কী-বোর্ড"
                onClick={() => setHardware(!hardware)}
                className={cn("relative h-7 w-12 shrink-0 rounded-full transition", hardware ? "bg-emerald-600" : "bg-zinc-300")}
              >
                <span className={cn("absolute top-1 size-5 rounded-full bg-white shadow transition-all", hardware ? "left-6" : "left-1")} />
              </button>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
