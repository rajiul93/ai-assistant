"use client";
import { useEffect, useRef } from "react";
import { applyBijoyKey, type BijoyPending } from "@/lib/typing/bijoy";
import { useHardwareKeyboard, useTypingKeyboard } from "@/store/typing-keyboard";

/** Sent by TypingWorkspace when a key is pressed while nothing is focused: `detail` is the key. */
export const TYPE_KEY_EVENT = "prep:type-key";

type Props = {
  value: string;
  onChange: (value: string) => void;
  bijoy: boolean;
  multiline?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
};

// Plain text box that, in Bijoy mode, turns English-keyboard keystrokes into Bangla
// the way the Bijoy software does — no Bangla keyboard needs to be installed.
// Works with a keyboard plugged into a phone (OTG/Bluetooth): see useTypingKeyboard.
export function TypingInput({ value, onChange, bijoy, multiline, disabled, placeholder, className }: Props) {
  const pending = useRef<BijoyPending>("none");
  const hardware = useHardwareKeyboard();
  const noteKey = useTypingKeyboard((state) => state.noteKey);

  /** Bijoy: the key as Bangla (true = handled). Plain keys are left to the browser. */
  function typeKey(key: string, current: string) {
    const next = applyBijoyKey({ text: current, pending: pending.current }, key);
    if (!next) return false;
    pending.current = next.pending;
    onChange(next.text);
    return true;
  }

  function onKeyDown(event: React.KeyboardEvent) {
    noteKey(event.nativeEvent);
    if (!bijoy || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    if (typeKey(event.key, value)) event.preventDefault();
  }

  // A key forwarded from the page (pressed before the box had focus) is typed here.
  const box = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const latest = useRef({ value, bijoy, onChange, typeKey });
  useEffect(() => { latest.current = { value, bijoy, onChange, typeKey }; });
  useEffect(() => {
    const element = box.current;
    if (!element) return;
    const onTypeKey = (event: Event) => {
      const key = (event as CustomEvent<string>).detail;
      const { value: current, bijoy: isBijoy, onChange: change, typeKey: type } = latest.current;
      if (!(isBijoy && type(key, current))) change(current + key);
    };
    element.addEventListener(TYPE_KEY_EVENT, onTypeKey);
    return () => element.removeEventListener(TYPE_KEY_EVENT, onTypeKey);
  }, []);

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const next = event.target.value;
    // Some Android keyboards (and some OTG setups) send keydown as "Unidentified", so the key
    // arrives only as typed text. One new character at the end is converted here instead.
    if (bijoy && next.length === value.length + 1 && next.startsWith(value)) {
      const converted = applyBijoyKey({ text: value, pending: pending.current }, next.slice(-1));
      if (converted) {
        pending.current = converted.pending;
        onChange(converted.text);
        return;
      }
    }
    pending.current = "none";
    onChange(next);
  }

  const shared = {
    ref: box,
    value,
    disabled,
    placeholder,
    onKeyDown,
    onChange: handleChange,
    autoCapitalize: "off",
    autoComplete: "off",
    autoCorrect: "off",
    spellCheck: false,
    // A plugged-in keyboard: no on-screen keyboard, and the box is ready to type into.
    inputMode: hardware ? ("none" as const) : undefined,
    autoFocus: hardware,
    "data-typing-input": "",
  };
  const classes = `w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-xl outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-50 ${className ?? ""}`;
  return multiline
    ? <textarea rows={4} {...shared} className={`${classes} py-2`} />
    : <input {...shared} className={`${classes} h-12`} />;
}

// Target text with each character coloured by whether it was typed correctly.
export function TargetText({ target, typed, className }: { target: string; typed: string; className?: string }) {
  return (
    <p className={`rounded-2xl border border-slate-200 bg-white p-4 leading-relaxed [overflow-wrap:anywhere] ${className ?? "text-2xl"}`}>
      {[...target].map((char, index) => {
        const state = index >= typed.length ? (index === typed.length ? "border-b-2 border-emerald-600" : "text-zinc-500") : typed[index] === char ? "text-emerald-700" : "bg-red-100 text-red-700";
        return <span key={index} className={state}>{char}</span>;
      })}
    </p>
  );
}
