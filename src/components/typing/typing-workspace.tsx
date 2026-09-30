"use client";
import { useState } from "react";
import { banglaLayouts, type TypingLanguage, type TypingMethod } from "@/lib/typing/layouts";
import { ConjunctPanel, LearnPanel, PracticePanel, ProgressPanel, TestPanel } from "./typing-panels";

const tabs = [
  { id: "learn", label: "Learn", Panel: LearnPanel },
  { id: "practice", label: "Practice", Panel: PracticePanel },
  { id: "conjunct", label: "যুক্তবর্ণ", Panel: ConjunctPanel },
  { id: "test", label: "Typing test", Panel: TestPanel },
  { id: "progress", label: "Progress", Panel: ProgressPanel },
] as const;

const toggle = (active: boolean) =>
  `rounded border transition ${active ? "border-emerald-700 bg-emerald-50 font-semibold text-emerald-950" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"}`;

export function TypingWorkspace() {
  const [language, setLanguage] = useState<TypingLanguage>("bn");
  const [method, setMethod] = useState<TypingMethod>("bijoy-unicode");
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("learn");
  const layout = banglaLayouts.find((item) => item.id === method) ?? banglaLayouts[0];
  const { Panel } = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-emerald-700">PREP / SKILL ROOM 02</p>
          <h1 className="mt-1 text-2xl font-semibold">Typing lab / টাইপিং ল্যাব</h1>
        </div>
        <div className="flex gap-2">
          {([["bn", "বাংলা"], ["en", "English"]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setLanguage(id)} aria-pressed={language === id} className={`rounded border px-4 py-2 ${language === id ? "bg-zinc-900 text-white" : "bg-white"}`}>{label}</button>
          ))}
        </div>
      </header>

      <nav className="space-y-3 border-y py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="tablist" className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button key={tab.id} role="tab" onClick={() => setActiveTab(tab.id)} aria-selected={activeTab === tab.id} className={`px-3 py-2 text-sm ${toggle(activeTab === tab.id)}`}>{tab.label}</button>
            ))}
          </div>
          {language === "bn" && (
            <div role="group" aria-label="বাংলা typing method" className="flex flex-wrap gap-1">
              {banglaLayouts.map((item) => (
                <button key={item.id} onClick={() => setMethod(item.id)} aria-pressed={method === item.id} className={`px-2 py-1 text-xs ${toggle(method === item.id)}`}>{item.name}</button>
              ))}
            </div>
          )}
        </div>
        {language === "bn" && (
          <p className="text-xs text-zinc-500">
            <span className="font-semibold text-zinc-700">{layout.name}</span> · {layout.encoding} — {layout.note} তিনটিতেই কী-বোর্ড লেআউট একই, তাই এখানে শেখা সব কী সবগুলোতে কাজ করবে।
          </p>
        )}
      </nav>

      <Panel key={language} language={language} method={method} />
    </div>
  );
}
