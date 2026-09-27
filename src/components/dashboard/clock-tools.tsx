"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, Flag, Pause, Play, RotateCcw, Timer, Watch } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stopwatch and countdown timer, entirely in the browser (nothing is saved to the server).
 * Both keep start times rather than counting ticks, so they stay right when the tab sleeps,
 * and remember their state in this browser so leaving the page doesn't reset them.
 */

type Stopwatch = { startedAt: number | null; elapsed: number; laps: number[] };
type Countdown = { total: number; endsAt: number | null; left: number; done: boolean };

const STORE_KEY = "prep-clock-tools";
const presets = [5, 10, 25, 45, 60];

type Custom = { h: string; m: string; s: string };
const emptyCustom: Custom = { h: "", m: "", s: "" };

function load(): { tab: "stopwatch" | "timer"; stopwatch: Stopwatch; timer: Countdown; custom?: Custom } | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(value: unknown) {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(value)); } catch { /* private mode: just don't remember */ }
}

const pad = (value: number) => String(value).padStart(2, "0");

/** 1:02:03.4 / 02:03.4 */
function formatWatch(ms: number) {
  const tenths = Math.floor(ms / 100) % 10;
  const seconds = Math.floor(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const body = `${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  return { main: h ? `${h}:${body}` : body, tenths };
}

/** 1:02:03 / 02:03, rounding up so it shows 00:01 until the very end. */
function formatLeft(ms: number) {
  const seconds = Math.ceil(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const body = `${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  return h ? `${h}:${body}` : body;
}

/**
 * A loud alarm clip (four sharp beeps, then a pause), built once as a WAV in memory. It plays
 * through an <audio> element at full volume and loops: unlike Web Audio, a media element also
 * sounds on iPhones with the silent switch on and keeps playing in a background tab.
 */
let alarmUrl: string | null = null;
function alarmSrc() {
  if (alarmUrl) return alarmUrl;
  const rate = 22_050;
  const seconds = 1.6;
  const count = Math.floor(rate * seconds);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (at: number, value: string) => [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const slot = Math.floor(t / 0.2); // 0.12s beep + 0.08s gap, four times, then silence
    const inBeep = slot < 4 && t - slot * 0.2 < 0.12;
    const frequency = slot % 2 ? 2_000 : 2_600;
    // A driven sine (almost square) is much louder than a plain one at the same peak.
    const sample = inBeep ? Math.tanh(4 * Math.sin(2 * Math.PI * frequency * t)) * 0.98 : 0;
    view.setInt16(44 + i * 2, sample * 32_767, true);
  }
  alarmUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return alarmUrl;
}

const emptyWatch: Stopwatch = { startedAt: null, elapsed: 0, laps: [] };
const emptyTimer: Countdown = { total: 25 * 60_000, endsAt: null, left: 25 * 60_000, done: false };

export function ClockTools() {
  const [tab, setTab] = useState<"stopwatch" | "timer">("stopwatch");
  const [watch, setWatch] = useState<Stopwatch>(emptyWatch);
  const [timer, setTimer] = useState<Countdown>(emptyTimer);
  const [now, setNow] = useState(0);
  const [loaded, setLoaded] = useState(false);
  // The student's own time; while it has a value the timer uses only that, not a preset.
  const [custom, setCustom] = useState<Custom>(emptyCustom);
  const alarm = useRef<HTMLAudioElement | null>(null);
  // Set when the browser refused to play the alarm (no tap since the page loaded).
  const [soundBlocked, setSoundBlocked] = useState(false);

  // Restore after mount (the server can't know what this browser saved).
  useEffect(() => {
    const saved = load();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
    if (saved) { setTab(saved.tab); setWatch(saved.stopwatch); setTimer(saved.timer); setCustom(saved.custom ?? emptyCustom); }
    setNow(Date.now());
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) save({ tab, stopwatch: watch, timer, custom }); }, [loaded, tab, watch, timer, custom]);

  const watchRunning = watch.startedAt !== null;
  const timerRunning = timer.endsAt !== null;

  // Tick only while something runs: 10×/s for the stopwatch's tenths, 4×/s for the timer.
  useEffect(() => {
    if (!watchRunning && !timerRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), watchRunning ? 100 : 250);
    const wake = () => setNow(Date.now());
    document.addEventListener("visibilitychange", wake);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", wake); };
  }, [watchRunning, timerRunning]);

  // One timeout aimed at the end itself: background tabs slow intervals down, so this rings on time.
  useEffect(() => {
    if (timer.endsAt === null) return;
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(0, timer.endsAt - Date.now()) + 20);
    return () => window.clearTimeout(id);
  }, [timer.endsAt]);

  // Finish the countdown (also when the tab was asleep past the end).
  useEffect(() => {
    if (timer.endsAt !== null && now >= timer.endsAt) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to the clock passing the end time
      setTimer((value) => ({ ...value, endsAt: null, left: 0, done: true }));
    }
  }, [now, timer.endsAt]);

  /** The alarm element, made on first use (browser only). */
  function alarmElement() {
    if (!alarm.current) {
      const element = new Audio(alarmSrc());
      element.loop = true;
      element.preload = "auto";
      alarm.current = element;
    }
    return alarm.current;
  }

  /**
   * Browsers only let a page make sound after a tap, and only for an element that tap played.
   * So every Start plays the alarm silently for a moment; when time is up it can ring on its own.
   */
  function unlockAudio() {
    const element = alarmElement();
    if (!element.paused) return;
    element.muted = true;
    void element.play().then(() => { element.pause(); element.currentTime = 0; element.muted = false; }).catch(() => { element.muted = false; });
  }

  // Ring at full volume, looping, until Stop; vibrate phones too.
  useEffect(() => {
    if (!timer.done) return;
    const element = alarmElement();
    element.muted = false;
    element.volume = 1;
    element.currentTime = 0;
    const ring = () => element.play().then(() => setSoundBlocked(false)).catch(() => setSoundBlocked(true));
    void ring();
    // If the browser blocked it (e.g. the page was reloaded while counting), the first tap anywhere rings it.
    const retry = () => { if (element.paused) void ring(); };
    document.addEventListener("pointerdown", retry);
    navigator.vibrate?.([400, 200, 400, 200, 400]);
    const buzz = window.setInterval(() => navigator.vibrate?.([400, 200, 400, 200, 400]), 1600);
    return () => {
      document.removeEventListener("pointerdown", retry);
      window.clearInterval(buzz);
      navigator.vibrate?.(0);
      element.pause();
      element.currentTime = 0;
      setSoundBlocked(false);
    };
  }, [timer.done]);

  const watchMs = watch.elapsed + (watch.startedAt !== null ? Math.max(0, now - watch.startedAt) : 0);
  const timerLeft = timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.left;
  const timerFraction = timer.total ? timerLeft / timer.total : 0;
  const shown = formatWatch(watchMs);

  const toggleWatch = () => {
    const at = Date.now();
    setNow(at);
    setWatch((value) => value.startedAt !== null
      ? { ...value, startedAt: null, elapsed: value.elapsed + (at - value.startedAt) }
      : { ...value, startedAt: at });
  };
  const lap = () => setWatch((value) => ({ ...value, laps: [watchMs, ...value.laps].slice(0, 50) }));

  const setDuration = (ms: number) => setTimer({ total: ms, endsAt: null, left: ms, done: false });
  const toggleTimer = () => {
    const at = Date.now();
    setNow(at);
    if (timer.done) { setTimer((value) => ({ ...value, done: false, left: value.total })); return; }
    if (timerRunning) setTimer((value) => ({ ...value, endsAt: null, left: Math.max(0, (value.endsAt ?? at) - at) }));
    else if (timer.left > 0) { unlockAudio(); setTimer((value) => ({ ...value, endsAt: at + value.left })); }
  };
  const addMinute = () => { unlockAudio(); setTimer((value) => ({
    ...value,
    done: false,
    total: value.total + 60_000,
    left: value.endsAt === null ? value.left + 60_000 : value.left,
    endsAt: value.endsAt === null ? null : value.endsAt + 60_000,
  })); };
  const msOf = (value: Custom) => ((Number(value.h) || 0) * 3600 + (Number(value.m) || 0) * 60 + (Number(value.s) || 0)) * 1000;
  const usingCustom = msOf(custom) > 0;
  /** Typing a time sets the timer straight away; emptying it goes back to the last preset (25m by default). */
  const editCustom = (unit: keyof Custom, raw: string) => {
    const next = { ...custom, [unit]: raw.replace(/\D/g, "").slice(0, unit === "h" ? 2 : 3) };
    setCustom(next);
    setDuration(msOf(next) || emptyTimer.total);
  };
  const pickPreset = (minutes: number) => { setCustom(emptyCustom); setDuration(minutes * 60_000); };

  const ring = 2 * Math.PI * 52;

  return <section className="rounded-2xl border border-zinc-200 bg-white p-3 sm:p-4" aria-label="Stopwatch and timer">
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
      {([["stopwatch", "Stopwatch", Watch, watchRunning], ["timer", "Timer", Timer, timerRunning || timer.done]] as const).map(([id, label, Icon, live]) => (
        <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={cn("flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition", tab === id ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}>
          <Icon className="size-4" /> {label}
          {live && tab !== id ? <span className="size-1.5 rounded-full bg-emerald-500" aria-label="running" /> : null}
        </button>
      ))}
    </div>

    {tab === "stopwatch" ? <div className="pt-4">
      <p className="text-center font-mono text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl" aria-live="off">
        {shown.main}<span className="text-2xl text-zinc-400 sm:text-3xl">.{shown.tenths}</span>
      </p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setWatch(emptyWatch)} disabled={!watchMs} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"><RotateCcw className="size-4" /> Reset</button>
        <button type="button" onClick={toggleWatch} className={cn("flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white", watchRunning ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700")}>
          {watchRunning ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> {watchMs ? "Resume" : "Start"}</>}
        </button>
        <button type="button" onClick={lap} disabled={!watchRunning} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"><Flag className="size-4" /> Lap</button>
      </div>
      {watch.laps.length ? <ol className="mt-3 max-h-40 divide-y divide-zinc-100 overflow-y-auto rounded-xl bg-zinc-50 text-sm">
        {watch.laps.map((at, index) => {
          const previous = watch.laps[index + 1] ?? 0;
          const split = formatWatch(at - previous);
          const total = formatWatch(at);
          return <li key={watch.laps.length - index} className="flex items-center justify-between px-3 py-1.5 font-mono tabular-nums">
            <span className="text-zinc-500">Lap {watch.laps.length - index}</span>
            <span>+{split.main}.{split.tenths}</span>
            <span className="text-zinc-400">{total.main}.{total.tenths}</span>
          </li>;
        })}
      </ol> : null}
    </div> : <div className="pt-4">
      <div className="relative mx-auto size-40 sm:size-44">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-zinc-100" />
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - timerFraction)} className={cn("transition-[stroke-dashoffset] duration-300", timer.done ? "stroke-red-500" : "stroke-indigo-500")} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {timer.done
            ? <><BellRing className="size-7 animate-bounce text-red-500" /><span className="mt-1 text-sm font-semibold text-red-600">সময় শেষ!</span>{soundBlocked ? <span className="mt-0.5 px-4 text-center text-[11px] text-zinc-500">শব্দ শুনতে যেকোনো জায়গায় tap করো</span> : null}</>
            : <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight sm:text-[2.6rem]">{formatLeft(timerLeft)}</span>}
        </div>
      </div>

      {!timerRunning && !timer.done ? <div className="mt-3 space-y-2">
        <div className="flex flex-wrap justify-center gap-1.5">
          {presets.map((minutes) => <button key={minutes} type="button" onClick={() => pickPreset(minutes)} className={cn("h-8 rounded-full px-3 text-xs font-medium ring-1", !usingCustom && timer.total === minutes * 60_000 ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-zinc-700 ring-zinc-200 hover:bg-zinc-50")}>{minutes}m</button>)}
        </div>
        <div className={cn("flex items-center justify-center gap-1.5 rounded-xl py-1.5", usingCustom && "bg-indigo-50 ring-1 ring-indigo-200")}>
          <span className="text-xs font-medium text-zinc-600">নিজের সময়:</span>
          {(["h", "m", "s"] as const).map((unit) => <label key={unit} className="flex items-center gap-0.5 text-xs text-zinc-500">
            <input value={custom[unit]} onChange={(event) => editCustom(unit, event.target.value)} inputMode="numeric" placeholder="0" aria-label={{ h: "Hours", m: "Minutes", s: "Seconds" }[unit]} className="h-9 w-12 rounded-lg border border-zinc-200 bg-white text-center font-mono text-sm text-zinc-900 outline-none focus:border-indigo-400" />{unit}
          </label>)}
        </div>
      </div> : null}

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button type="button" onClick={() => setDuration(timer.total)} disabled={!timer.done && !timerRunning && timer.left === timer.total} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-zinc-100 text-sm font-medium text-zinc-700 hover:bg-zinc-200 disabled:opacity-40"><RotateCcw className="size-4" /> Reset</button>
        <button type="button" onClick={toggleTimer} disabled={!timer.done && !timerRunning && timer.left <= 0} className={cn("flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40", timer.done ? "bg-red-600 hover:bg-red-700" : timerRunning ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700")}>
          {timer.done ? <><BellRing className="size-4" /> Stop</> : timerRunning ? <><Pause className="size-4" /> Pause</> : <><Play className="size-4" /> {timer.left < timer.total ? "Resume" : "Start"}</>}
        </button>
        <button type="button" onClick={addMinute} className="flex h-11 items-center justify-center rounded-xl bg-zinc-100 text-sm font-medium text-zinc-700 hover:bg-zinc-200">+1 min</button>
      </div>
    </div>}
  </section>;
}
