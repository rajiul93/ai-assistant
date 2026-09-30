"use client";
import { useRef } from "react";
import { applyBijoyKey, type BijoyPending } from "@/lib/typing/bijoy";

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
export function TypingInput({ value, onChange, bijoy, multiline, disabled, placeholder, className }: Props) {
  const pending = useRef<BijoyPending>("none");

  function onKeyDown(event: React.KeyboardEvent) {
    if (!bijoy || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    const next = applyBijoyKey({ text: value, pending: pending.current }, event.key);
    if (!next) return;
    event.preventDefault();
    pending.current = next.pending;
    onChange(next.text);
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    pending.current = "none";
    onChange(event.target.value);
  }

  const classes = `w-full rounded border border-zinc-300 bg-white px-3 text-xl outline-none focus:border-emerald-600 disabled:bg-zinc-50 ${className ?? ""}`;
  return multiline ? (
    <textarea rows={4} value={value} disabled={disabled} placeholder={placeholder} onKeyDown={onKeyDown} onChange={handleChange} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} className={`${classes} py-2`} />
  ) : (
    <input value={value} disabled={disabled} placeholder={placeholder} onKeyDown={onKeyDown} onChange={handleChange} autoCapitalize="off" autoComplete="off" autoCorrect="off" spellCheck={false} className={`${classes} h-12`} />
  );
}

// Target text with each character coloured by whether it was typed correctly.
export function TargetText({ target, typed, className }: { target: string; typed: string; className?: string }) {
  return (
    <p className={`rounded border border-zinc-200 bg-white p-4 leading-relaxed ${className ?? "text-2xl"}`}>
      {[...target].map((char, index) => {
        const state = index >= typed.length ? (index === typed.length ? "border-b-2 border-emerald-600" : "text-zinc-500") : typed[index] === char ? "text-emerald-700" : "bg-red-100 text-red-700";
        return <span key={index} className={state}>{char}</span>;
      })}
    </p>
  );
}
