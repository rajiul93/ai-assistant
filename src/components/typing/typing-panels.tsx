"use client";
import { useEffect, useRef, useState } from "react";
import { bijoySequence, formatKey, typeBijoyKeys } from "@/lib/typing/bijoy";
import { banglaLayouts, conjuncts, lessonGroups, practiceTexts, testPassages, type PracticeLevel, type TypingLanguage, type TypingMethod } from "@/lib/typing/layouts";
import { clearResults, loadResults, saveResult, scoreTyping, type TypingResult } from "@/lib/typing/progress";
import { KeyboardGuide } from "./keyboard-guide";
import { TargetText, TypingInput } from "./typing-input";

type PanelProps = { language: TypingLanguage; method: TypingMethod };

const chip = (active: boolean) =>
  `rounded border px-3 py-1.5 text-sm transition ${active ? "border-emerald-700 bg-emerald-50 font-semibold text-emerald-950" : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-400"}`;

const keysFor = (char: string, language: TypingLanguage) => (language === "bn" ? bijoySequence(char) ?? [] : [char]);

export function LearnPanel({ language }: PanelProps) {
  const groups = lessonGroups[language];
  const [groupIndex, setGroupIndex] = useState(0);
  const [lesson, setLesson] = useState(0);
  const [typed, setTyped] = useState("");
  const group = groups[groupIndex] ?? groups[0];
  const character = group.items[lesson % group.items.length];
  const keys = keysFor(character, language);
  const correct = typed.normalize() === character.normalize();

  function goTo(index: number) {
    setLesson(index);
    setTyped("");
  }

  // Move on automatically once the character is typed correctly.
  useEffect(() => {
    if (!correct) return;
    const timer = setTimeout(() => goTo((lesson + 1) % group.items.length), 700);
    return () => clearTimeout(timer);
  }, [correct, lesson, group.items.length]);

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {groups.map((item, index) => (
            <button key={item.title} onClick={() => { setGroupIndex(index); goTo(0); }} className={chip(groupIndex === index)}>
              {item.title} <span className="text-xs opacity-70">· {item.subtitle}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {group.items.map((item, index) => (
            <button key={item} onClick={() => goTo(index)} className={`grid size-10 place-items-center rounded border text-lg ${lesson === index ? "border-emerald-700 bg-emerald-50" : "border-zinc-200 bg-white"}`}>{item}</button>
          ))}
        </div>
        <div className="flex items-center gap-4 border-l-2 border-emerald-500 bg-white py-3 pl-4">
          <span className="text-5xl">{character}</span>
          <span className="text-sm text-zinc-600">{keys.length ? keys.map(formatKey).join("  →  ") : "—"}</span>
        </div>
        <TypingInput value={typed} onChange={setTyped} bijoy={language === "bn"} placeholder={language === "bn" ? "উপরের কী চেপে অক্ষরটি লিখুন" : "Type the highlighted key"} />
        <div className="flex items-center justify-between">
          <span role="status" className={`text-sm ${correct ? "text-emerald-700" : "text-zinc-500"}`}>
            {correct ? "সঠিক হয়েছে!" : typed ? "আবার চেষ্টা করুন" : `${lesson + 1} / ${group.items.length}`}
          </span>
          <div className="flex gap-3">
            <button onClick={() => setTyped("")} className="text-sm text-zinc-500">Clear</button>
            <button onClick={() => goTo((lesson + 1) % group.items.length)} className="text-emerald-800">Next →</button>
          </div>
        </div>
      </div>
      <aside className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h3 className="mb-4 font-semibold">Keyboard & finger guide</h3>
        <KeyboardGuide keys={keys} showBangla={language === "bn"} />
      </aside>
    </section>
  );
}

export function PracticePanel({ language, method }: PanelProps) {
  const [level, setLevel] = useState<PracticeLevel>("character");
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [result, setResult] = useState<{ wpm: number; accuracy: number } | null>(null);
  const texts = practiceTexts[language][level];
  const target = texts[index % texts.length];
  const accuracy = scoreTyping(target, typed, 60).accuracy;

  function reset(nextIndex = index) {
    setIndex(nextIndex);
    setTyped("");
    setStartedAt(null);
    setResult(null);
  }

  function handleType(value: string) {
    const start = startedAt ?? Date.now();
    setStartedAt(start);
    setTyped(value);
    if (value.normalize() !== target.normalize() || result) return;
    const seconds = Math.max(Math.round((Date.now() - start) / 1000), 1);
    const score = scoreTyping(target, value, seconds);
    setResult(score);
    saveResult({ kind: "practice", language, method: language === "bn" ? method : null, ...score, seconds });
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["character", "word", "sentence", "passage"] as const).map((item) => (
          <button key={item} onClick={() => { setLevel(item); reset(0); }} className={chip(level === item)}>{item[0].toUpperCase() + item.slice(1)}</button>
        ))}
      </div>
      <TargetText target={target} typed={typed} />
      <TypingInput
        value={typed}
        onChange={handleType}
        bijoy={language === "bn"}
        multiline={level === "passage"}
        placeholder={language === "bn" ? "এখানে টাইপ করুন…" : "Start typing…"}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className={result ? "font-semibold text-emerald-700" : "text-zinc-600"}>
          {result ? `শেষ! ${result.wpm} WPM · ${result.accuracy}% accuracy` : typed ? `Accuracy ${accuracy}%` : "টাইপ শুরু করলেই সময় গণনা শুরু হবে"}
        </span>
        <div className="flex gap-3">
          <button onClick={() => reset()} className="text-zinc-500">Restart</button>
          <button onClick={() => reset((index + 1) % texts.length)} className="rounded bg-zinc-900 px-4 py-2 text-white">Next →</button>
        </div>
      </div>
    </section>
  );
}

export function ConjunctPanel({ language }: PanelProps) {
  const [selected, setSelected] = useState(0);
  const [typed, setTyped] = useState("");
  const item = conjuncts[selected];
  const keys = item.keys.split(" ");
  const done = typed.normalize() === item.word.normalize();

  if (language !== "bn") return <p className="text-zinc-600">যুক্তবর্ণ অনুশীলনের জন্য উপরে “বাংলা” নির্বাচন করুন।</p>;

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {conjuncts.map((conjunct, index) => (
            <button key={conjunct.text} onClick={() => { setSelected(index); setTyped(""); }} className={`h-11 min-w-11 rounded border px-2 text-lg ${selected === index ? "border-emerald-700 bg-emerald-50" : "border-zinc-200 bg-white"}`}>{conjunct.text}</button>
          ))}
        </div>
        <div className="space-y-2 border-l-2 border-emerald-500 bg-white py-3 pl-4">
          <p className="text-5xl">{item.text}</p>
          <p className="text-sm text-zinc-600">{keys.map(formatKey).join("  →  ")} <span className="text-zinc-400">= {typeBijoyKeys(keys)}</span></p>
          <p className="text-sm text-zinc-600">উদাহরণ শব্দ: <span className="text-lg text-zinc-900">{item.word}</span></p>
        </div>
        <TargetText target={item.word} typed={typed} />
        <TypingInput value={typed} onChange={setTyped} bijoy placeholder={`“${item.word}” টাইপ করুন`} />
        <div className="flex items-center justify-between text-sm">
          <span role="status" className={done ? "text-emerald-700" : "text-zinc-500"}>{done ? "সঠিক হয়েছে!" : "হসন্ত (G) দিয়ে দুটি বর্ণ যুক্ত হয়"}</span>
          <button onClick={() => { setSelected((selected + 1) % conjuncts.length); setTyped(""); }} className="text-emerald-800">Next →</button>
        </div>
      </div>
      <aside className="border-t pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
        <h3 className="mb-4 font-semibold">Key sequence</h3>
        <KeyboardGuide keys={keys} showBangla />
      </aside>
    </section>
  );
}

const durations = [60, 120, 300];

export function TestPanel({ language, method }: PanelProps) {
  const [duration, setDuration] = useState(60);
  const [passageIndex, setPassageIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<{ wpm: number; accuracy: number } | null>(null);
  const typedRef = useRef("");
  const passages = testPassages[language];
  const passage = passages[passageIndex % passages.length];
  const elapsed = startedAt ? Math.min((now - startedAt) / 1000, duration) : 0;
  const finished = result !== null;

  function reset(nextPassage = passageIndex) {
    setPassageIndex(nextPassage);
    setTyped("");
    typedRef.current = "";
    setStartedAt(null);
    setResult(null);
  }

  function finish(start: number, value: string) {
    const seconds = Math.max(Math.round(Math.min((Date.now() - start) / 1000, duration)), 1);
    const score = scoreTyping(passage, value, seconds);
    setResult(score);
    saveResult({ kind: "test", language, method: language === "bn" ? method : null, ...score, seconds });
  }

  function handleType(value: string) {
    const start = startedAt ?? Date.now();
    setStartedAt(start);
    setNow(Date.now());
    setTyped(value);
    typedRef.current = value;
    if (value.length >= passage.length) finish(start, value);
  }

  // Tick the clock and end the test when time runs out.
  useEffect(() => {
    if (!startedAt || finished) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() - startedAt >= duration * 1000) finish(startedAt, typedRef.current);
    }, 250);
    return () => clearInterval(timer);
  });

  const live = scoreTyping(passage, typed, elapsed);
  const remaining = Math.ceil(duration - elapsed);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {durations.map((item) => (
            <button key={item} onClick={() => { setDuration(item); reset(0); }} disabled={!!startedAt && !finished} className={chip(duration === item)}>{item / 60} min</button>
          ))}
        </div>
        <div className="flex gap-4 font-mono text-sm">
          <span>⏱ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span>
          <span>{live.wpm} WPM</span>
          <span>{live.accuracy}%</span>
        </div>
      </div>
      <TargetText target={passage} typed={typed} className="text-xl" />
      <TypingInput
        value={typed}
        onChange={handleType}
        bijoy={language === "bn"}
        multiline
        disabled={finished}
        placeholder={language === "bn" ? "টাইপ শুরু করলেই টাইমার চালু হবে…" : "The timer starts on your first keystroke…"}
      />
      {result && (
        <div className="flex flex-wrap items-center gap-6 rounded border border-emerald-200 bg-emerald-50 p-4">
          <div><p className="text-xs text-emerald-800">Speed</p><p className="text-2xl font-semibold">{result.wpm} WPM</p></div>
          <div><p className="text-xs text-emerald-800">Accuracy</p><p className="text-2xl font-semibold">{result.accuracy}%</p></div>
          <p className="text-sm text-emerald-900">ফলাফল Progress ট্যাবে সংরক্ষিত হয়েছে।</p>
        </div>
      )}
      <div className="flex justify-end gap-3">
        <button onClick={() => reset()} className="text-sm text-zinc-500">Restart</button>
        <button onClick={() => reset((passageIndex + 1) % passages.length)} className="rounded bg-zinc-900 px-4 py-2 text-white">New passage</button>
      </div>
    </section>
  );
}

export function ProgressPanel() {
  const [results, setResults] = useState<TypingResult[]>(loadResults);

  const tests = results.filter((result) => result.kind === "test");
  const best = tests.reduce((max, result) => Math.max(max, result.wpm), 0);
  const average = (values: number[]) => (values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0);
  const recent = tests.slice(0, 5);

  if (!results.length) return <p className="text-zinc-600">এখনো কোনো ফলাফল নেই। Practice বা Typing test শেষ করলে এখানে অগ্রগতি দেখা যাবে।</p>;

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Best speed", `${best} WPM`],
          ["Recent avg speed", `${average(recent.map((result) => result.wpm))} WPM`],
          ["Recent avg accuracy", `${average(recent.map((result) => result.accuracy))}%`],
          ["Sessions", `${tests.length} tests · ${results.length - tests.length} practice`],
        ].map(([label, value]) => (
          <div key={label} className="rounded border border-zinc-200 bg-white p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded border border-zinc-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-zinc-50 text-xs text-zinc-500">
            <tr><th className="p-2">When</th><th className="p-2">Type</th><th className="p-2">Language</th><th className="p-2">WPM</th><th className="p-2">Accuracy</th><th className="p-2">Time</th></tr>
          </thead>
          <tbody>
            {results.slice(0, 30).map((result) => (
              <tr key={result.at} className="border-b last:border-0">
                <td className="p-2 text-zinc-600">{new Date(result.at).toLocaleString()}</td>
                <td className="p-2">{result.kind === "test" ? "Typing test" : "Practice"}</td>
                <td className="p-2">{result.language === "bn" ? `বাংলা · ${banglaLayouts.find((layout) => layout.id === result.method)?.name ?? ""}` : "English"}</td>
                <td className="p-2 font-mono">{result.wpm}</td>
                <td className="p-2 font-mono">{result.accuracy}%</td>
                <td className="p-2 font-mono">{result.seconds}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => { clearResults(); setResults([]); }} className="text-sm text-red-600">Clear history</button>
    </section>
  );
}
