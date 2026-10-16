"use client";

import { useState, useTransition, type InputHTMLAttributes, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AiTier, ExamTrack, PlanDuration, PricingSettings } from "@prisma/client";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatTokens } from "@/lib/ai-limits";
import { taka } from "@/lib/billing-display";
import { quote, type PricingCatalog } from "@/lib/pricing";
import { BANK_EXAMS } from "@/lib/question-bank";
import { cn } from "@/lib/utils";
import { deleteDuration, deleteTrack, saveDuration, saveSettings, saveTier, saveTrack } from "@/server/actions/pricing";
import { errorMessage } from "@/lib/user-error";

export type PricingAdmin = { settings: PricingSettings | null; tiers: AiTier[]; tracks: ExamTrack[]; durations: PlanDuration[] };

const card = "rounded-3xl bg-white px-3.5 py-3 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.15)] sm:px-5 sm:py-4";
const input = "h-10 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-sm tabular-nums outline-none focus:border-blue-300";
const saveButton = "h-9 shrink-0 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-40";
const bankLabel = (exam: string | null) => BANK_EXAMS.find((item) => item.id === exam)?.label;

function useSave() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (action: () => Promise<unknown>, success: string, after?: () => void) => start(async () => {
    try { await action(); toast.success(success); after?.(); router.refresh(); } catch (error) { toast.error(errorMessage(error, "সেভ করা গেল না।")); }
  });
  return { pending, run };
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn("min-w-0 space-y-0.5", className)}><span className="block truncate text-[11px] font-medium text-slate-500">{label}</span>{children}</label>;
}

function NumberInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input inputMode="numeric" className={input} {...props} />;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-4 accent-blue-600" /> {label}</label>;
}

/**
 * One item as a single line — what it is and its numbers — with ✎ to open its form in place. Keeps
 * the whole panel to about a phone screen; only the row being edited grows.
 */
function Row({ title, detail, off, editing, onEdit, children }: { title: ReactNode; detail: ReactNode; off?: boolean; editing: boolean; onEdit: () => void; children: ReactNode }) {
  if (editing) return <li className="-mx-1.5 my-1 rounded-2xl bg-slate-50 p-2.5 ring-1 ring-blue-100">{children}</li>;
  return <li className="flex items-center gap-2 py-2">
    <div className={cn("min-w-0 flex-1", off && "opacity-50")}>
      <p className="truncate text-sm font-semibold text-slate-900">{title}</p>
      <p className="truncate text-[12px] text-slate-500">{detail}</p>
    </div>
    {off ? <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-500">বন্ধ</span> : null}
    <button type="button" onClick={onEdit} aria-label="বদলান" className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"><Pencil className="size-4" /></button>
  </li>;
}

/** Cancel / delete / save under a form. */
function FormActions({ onCancel, onDelete, onSave, saveLabel, disabled }: { onCancel: () => void; onDelete?: () => void; onSave: () => void; saveLabel: string; disabled?: boolean }) {
  return <div className="mt-2.5 flex items-center justify-end gap-1.5">
    {onDelete ? <button type="button" disabled={disabled} onClick={onDelete} aria-label="মুছুন" className="mr-auto flex size-9 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></button> : null}
    <button type="button" onClick={onCancel} className="h-9 rounded-full px-3.5 text-sm font-medium text-slate-600 hover:bg-slate-100">বাতিল</button>
    <button type="button" disabled={disabled} onClick={onSave} className={saveButton}>{saveLabel}</button>
  </div>;
}

function SettingsRow({ settings, gatewayConfigured }: { settings: PricingSettings | null; gatewayConfigured: boolean }) {
  const { pending, run } = useSave();
  const [editing, setEditing] = useState(false);
  const initial = { systemPriceBdt: String(settings?.systemPriceBdt ?? 100), allTracksDiscountPct: String(settings?.allTracksDiscountPct ?? 20), gatewayEnabled: settings?.gatewayEnabled ?? false };
  const [form, setForm] = useState(initial);
  const online = settings?.gatewayEnabled ? (gatewayConfigured ? "Online payment চালু" : "Online চালু, কিন্তু store-এর তথ্য নেই") : "Online payment বন্ধ";
  return <Row editing={editing} onEdit={() => { setForm(initial); setEditing(true); }} title={`System ${taka(settings?.systemPriceBdt ?? 0)} · সব পরীক্ষায় ${settings?.allTracksDiscountPct ?? 0}% ছাড়`} detail={online}>
    <div className="grid grid-cols-2 gap-2">
      <Field label="System (৳ / ৩০ দিন)"><NumberInput value={form.systemPriceBdt} onChange={(event) => setForm({ ...form, systemPriceBdt: event.target.value })} /></Field>
      <Field label="সব পরীক্ষায় ছাড় (%)"><NumberInput value={form.allTracksDiscountPct} onChange={(event) => setForm({ ...form, allTracksDiscountPct: event.target.value })} /></Field>
    </div>
    <div className="mt-2.5"><Toggle checked={form.gatewayEnabled} onChange={(gatewayEnabled) => setForm({ ...form, gatewayEnabled })} label="Online payment (SSLCommerz)" /></div>
    <p className={cn("mt-1 text-[11.5px]", gatewayConfigured ? "text-emerald-700" : "text-amber-700")}>{gatewayConfigured ? "Store-এর তথ্য server-এ আছে।" : "Server-এ SSLCOMMERZ_STORE_ID / PASSWORD নেই — চালু করলেও customer দেখবে না।"}</p>
    <FormActions onCancel={() => setEditing(false)} onSave={() => run(() => saveSettings(form), "সেভ হলো — নতুন কেনায় লাগবে", () => setEditing(false))} saveLabel="সেভ" disabled={pending} />
  </Row>;
}

function TierRow({ tier }: { tier: AiTier }) {
  const { pending, run } = useSave();
  const [editing, setEditing] = useState(false);
  const initial = { name: tier.name, priceBdt: String(tier.priceBdt), tokensPerMonth: String(tier.tokensPerMonth), messagesPerDay: String(tier.messagesPerDay), scansPerDay: String(tier.scansPerDay), suggestionsPerDay: String(tier.suggestionsPerDay), active: tier.active };
  const [form, setForm] = useState(initial);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });
  return <Row editing={editing} off={!tier.active} onEdit={() => { setForm(initial); setEditing(true); }} title={`${tier.name} · ${taka(tier.priceBdt)}`} detail={`দিনে ${tier.messagesPerDay} msg · ${tier.scansPerDay} scan · ${tier.suggestionsPerDay} sugg · ${formatTokens(tier.tokensPerMonth)} token/মাস`}>
    <div className="grid grid-cols-3 gap-2">
      <Field label="নাম" className="col-span-2"><input value={form.name} onChange={set("name")} className={input} /></Field>
      <Field label="৳ / ৩০ দিন"><NumberInput value={form.priceBdt} onChange={set("priceBdt")} /></Field>
      <Field label="Message/দিন"><NumberInput value={form.messagesPerDay} onChange={set("messagesPerDay")} /></Field>
      <Field label="Scan/দিন"><NumberInput value={form.scansPerDay} onChange={set("scansPerDay")} /></Field>
      <Field label="Sugg./দিন"><NumberInput value={form.suggestionsPerDay} onChange={set("suggestionsPerDay")} /></Field>
      <Field label={`Token / ৩০ দিন (${formatTokens(Number(form.tokensPerMonth) || 0)})`} className="col-span-2"><NumberInput value={form.tokensPerMonth} onChange={set("tokensPerMonth")} /></Field>
      <div className="flex items-end pb-2"><Toggle checked={form.active} onChange={(active) => setForm({ ...form, active })} label="চালু" /></div>
    </div>
    <FormActions onCancel={() => setEditing(false)} onSave={() => run(() => saveTier({ planType: tier.planType, ...form }), `${form.name} সেভ হলো`, () => setEditing(false))} saveLabel="সেভ" disabled={pending} />
  </Row>;
}

function TrackRow({ track, onDone }: { track: ExamTrack | null; onDone?: () => void }) {
  const { pending, run } = useSave();
  const [editing, setEditing] = useState(!track);
  const initial = { name: track?.name ?? "", priceBdt: String(track?.priceBdt ?? 150), bankExam: track?.bankExam ?? "", active: track?.active ?? true, sortOrder: String(track?.sortOrder ?? 10) };
  const [form, setForm] = useState(initial);
  const close = () => { setEditing(false); onDone?.(); };
  const save = () => run(() => saveTrack({ id: track?.id ?? null, ...form, bankExam: form.bankExam || null }), track ? "পরীক্ষা সেভ হলো" : "নতুন পরীক্ষা যোগ হলো", close);
  return <Row editing={editing} off={track ? !track.active : false} onEdit={() => { setForm(initial); setEditing(true); }} title={track ? `${track.name} · ${taka(track.priceBdt)}` : ""} detail={track ? `প্রশ্ন ব্যাংক: ${bankLabel(track.bankExam) ?? "যুক্ত নয়"}` : ""}>
    <div className="grid grid-cols-[1fr_6rem] gap-2">
      <Field label="নাম"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="যেমন: Bank Job" autoFocus={!track} className={input} /></Field>
      <Field label="৳ / ৩০ দিন"><NumberInput value={form.priceBdt} onChange={(event) => setForm({ ...form, priceBdt: event.target.value })} /></Field>
      <Field label="প্রশ্ন ব্যাংক">
        <select value={form.bankExam} onChange={(event) => setForm({ ...form, bankExam: event.target.value as typeof form.bankExam })} className={input}>
          <option value="">যুক্ত নয়</option>
          {BANK_EXAMS.map((exam) => <option key={exam.id} value={exam.id}>{exam.label}</option>)}
        </select>
      </Field>
      <Field label="ক্রম"><NumberInput value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></Field>
    </div>
    <div className="mt-2"><Toggle checked={form.active} onChange={(active) => setForm({ ...form, active })} label="বিক্রি চালু" /></div>
    <FormActions
      onCancel={close}
      onDelete={track ? () => { if (window.confirm(`“${track.name}” মুছে ফেলবেন?`)) run(() => deleteTrack(track.id), "মুছে ফেলা হলো"); } : undefined}
      onSave={save}
      saveLabel={track ? "সেভ" : "যোগ করুন"}
      disabled={pending || !form.name.trim()}
    />
  </Row>;
}

function DurationRow({ duration, onDone }: { duration: PlanDuration | null; onDone?: () => void }) {
  const { pending, run } = useSave();
  const [editing, setEditing] = useState(!duration);
  const initial = { days: String(duration?.days ?? 30), label: duration?.label ?? "", discountPct: String(duration?.discountPct ?? 0), active: duration?.active ?? true, sortOrder: String(duration?.sortOrder ?? 10) };
  const [form, setForm] = useState(initial);
  const close = () => { setEditing(false); onDone?.(); };
  return <Row editing={editing} off={duration ? !duration.active : false} onEdit={() => { setForm(initial); setEditing(true); }} title={duration ? `${duration.label} · ${duration.days} দিন` : ""} detail={duration ? (duration.discountPct ? `${duration.discountPct}% ছাড়` : "ছাড় নেই") : ""}>
    <div className="grid grid-cols-4 gap-2">
      <Field label="নাম" className="col-span-2"><input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="যেমন: ১ বছর" autoFocus={!duration} className={input} /></Field>
      <Field label="দিন"><NumberInput value={form.days} onChange={(event) => setForm({ ...form, days: event.target.value })} /></Field>
      <Field label="ছাড় %"><NumberInput value={form.discountPct} onChange={(event) => setForm({ ...form, discountPct: event.target.value })} /></Field>
    </div>
    <div className="mt-2 flex items-end gap-3">
      <div className="pb-2"><Toggle checked={form.active} onChange={(active) => setForm({ ...form, active })} label="চালু" /></div>
      <Field label="ক্রম" className="ml-auto w-20"><NumberInput value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} /></Field>
    </div>
    <FormActions
      onCancel={close}
      onDelete={duration ? () => { if (window.confirm(`“${duration.label}” মুছে ফেলবেন? কেনা plan-এ কোনো প্রভাব পড়বে না।`)) run(() => deleteDuration(duration.id), "মুছে ফেলা হলো"); } : undefined}
      onSave={() => run(() => saveDuration({ id: duration?.id ?? null, ...form }), duration ? "মেয়াদ সেভ হলো" : "নতুন মেয়াদ যোগ হলো", close)}
      saveLabel={duration ? "সেভ" : "যোগ করুন"}
      disabled={pending || !form.label.trim()}
    />
  </Row>;
}

/** The customers' 30-day prices from what is saved now, to check the numbers at a glance. */
function PricePreview({ data }: { data: PricingAdmin }) {
  const catalog: PricingCatalog = {
    systemPriceBdt: data.settings?.systemPriceBdt ?? 0,
    allTracksDiscountPct: data.settings?.allTracksDiscountPct ?? 0,
    tiers: data.tiers.filter((tier) => tier.active),
    tracks: data.tracks.filter((track) => track.active),
    durations: [{ id: "month", days: 30, label: "৩০ দিন", discountPct: 0 }],
  };
  const rows = [...catalog.tracks.map((track) => ({ id: track.id, name: track.name })), { id: "all", name: "সব পরীক্ষা" }];
  return <section className={card}>
    <h2 className="text-sm font-bold text-slate-900">Customer যা দেখবে <span className="font-normal text-slate-500">· ৩০ দিন</span></h2>
    <table className="mt-1.5 w-full text-[13px]">
      <thead><tr className="text-left text-[11px] text-slate-500"><th className="py-1 font-medium">Plan</th>{catalog.tiers.map((tier) => <th key={tier.planType} className="whitespace-nowrap py-1 pl-3 text-right font-medium">{tier.name}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => <tr key={row.id}><td className="py-1.5 pr-2 font-medium text-slate-800">{row.name}</td>{catalog.tiers.map((tier) => <td key={tier.planType} className="whitespace-nowrap py-1.5 pl-3 text-right font-semibold tabular-nums">{taka(quote(catalog, { planType: tier.planType, track: row.id, durationId: "month" })?.total ?? 0)}</td>)}</tr>)}
      </tbody>
    </table>
  </section>;
}

function Section({ title, hint, onAdd, children }: { title: string; hint: string; onAdd?: () => void; children: ReactNode }) {
  return <section className={card}>
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {onAdd ? <button type="button" onClick={onAdd} className="flex h-8 items-center gap-1 rounded-full bg-blue-50 px-3 text-[13px] font-semibold text-blue-700 hover:bg-blue-100"><Plus className="size-4" /> নতুন</button> : null}
    </div>
    <p className="text-[11.5px] leading-snug text-slate-500">{hint}</p>
    <ul className="mt-1 divide-y divide-slate-100">{children}</ul>
  </section>;
}

/**
 * The super admin's pricing: System price and the all-exams discount, both AI tiers with their
 * daily limits, the exams on sale and the durations — one line each, edited in place. Plans aren't
 * stored (the Plans page works them out from these), so a new exam is on sale as soon as it is saved.
 */
export function PricingPanel({ data, gatewayConfigured }: { data: PricingAdmin; gatewayConfigured: boolean }) {
  const [addingTrack, setAddingTrack] = useState(false);
  const [addingDuration, setAddingDuration] = useState(false);
  return <div className="space-y-3">
    <PricePreview data={data} />
    <Section title="সাধারণ" hint="সব দাম ৩০ দিনের। ছাড় শুধু পরীক্ষার অংশে, System বা AI-তে না।">
      <SettingsRow settings={data.settings} gatewayConfigured={gatewayConfigured} />
    </Section>
    <Section title="AI Tier" hint="দৈনিক সীমা সাথে সাথে সবার জন্য বদলায়; token আগের কেনায় যা ছিল তাই থাকে।">
      {data.tiers.map((tier) => <TierRow key={tier.planType} tier={tier} />)}
    </Section>
    <Section title="পরীক্ষা" hint="সেভ করলেই দুই Tier-এর plan আর “সব পরীক্ষা”-তে যোগ হয়; বন্ধ করলে দুই জায়গা থেকেই সরে।" onAdd={addingTrack ? undefined : () => setAddingTrack(true)}>
      {addingTrack ? <TrackRow track={null} onDone={() => setAddingTrack(false)} /> : null}
      {data.tracks.map((track) => <TrackRow key={track.id} track={track} />)}
    </Section>
    <Section title="মেয়াদ" hint="দাম দিন অনুযায়ী গুণ হয়, তারপর এর ছাড় বাদ যায়।" onAdd={addingDuration ? undefined : () => setAddingDuration(true)}>
      {addingDuration ? <DurationRow duration={null} onDone={() => setAddingDuration(false)} /> : null}
      {data.durations.map((duration) => <DurationRow key={duration.id} duration={duration} />)}
    </Section>
  </div>;
}
