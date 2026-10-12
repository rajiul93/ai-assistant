"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { matchesSelection, NO_TOPIC, OTHER, readSelection, topicsOf, type Filed, type FilterSelection, type SubjectNode, type TopicNode } from "@/lib/subject-filter";

/**
 * The subject → topic filter in the page URL (?subject=…&topic=…), keeping any other params
 * (e.g. ?status=). Returns the selection and a matcher for the page's items.
 */
export function useSubjectTopicFilter(subjects: SubjectNode[], topics: TopicNode[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selection = readSelection(searchParams);
  const subjectIds = new Set(subjects.map((subject) => subject.id));
  const select = (next: FilterSelection) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next.subject) params.set("subject", next.subject); else params.delete("subject");
    if (next.subject && next.subject !== OTHER && next.topic) params.set("topic", next.topic); else params.delete("topic");
    router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false });
  };
  const matches = (item: Filed, sel: FilterSelection = selection) => matchesSelection(item, sel, topics, subjectIds);
  return { selection, select, matches };
}

const chip = (active: boolean, empty = false) => cn(
  "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 transition",
  active ? "bg-zinc-950 text-white ring-zinc-950" : empty ? "bg-white text-zinc-400 ring-zinc-200 hover:ring-zinc-300" : "bg-white text-zinc-700 ring-zinc-200 hover:ring-zinc-400",
);
const count = (active: boolean, value: number) => <span className={cn("tabular-nums", active ? "text-white/70" : "text-zinc-400")}>{value}</span>;

/**
 * Chips for the user's subjects (each with how many items it holds), "Other" for items without a
 * subject, and — once a subject is chosen — its topics (a topic includes its sub-topics) and
 * "Topic নেই".
 */
export function SubjectTopicFilter({ subjects, topics, items, selection, onSelect, matches }: {
  subjects: SubjectNode[];
  topics: TopicNode[];
  items: Filed[];
  selection: FilterSelection;
  onSelect: (selection: FilterSelection) => void;
  matches: (item: Filed, selection: FilterSelection) => boolean;
}) {
  const countFor = (sel: FilterSelection) => items.filter((item) => matches(item, sel)).length;
  const otherCount = countFor({ subject: OTHER, topic: null });
  const subjectTopics = selection.subject && selection.subject !== OTHER ? topicsOf(selection.subject, topics) : [];

  return <div className="space-y-2">
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Subject">
      <button type="button" onClick={() => onSelect({ subject: null, topic: null })} aria-pressed={!selection.subject} className={chip(!selection.subject)}>সব {count(!selection.subject, items.length)}</button>
      {subjects.map((subject) => {
        const active = selection.subject === subject.id;
        const value = countFor({ subject: subject.id, topic: null });
        return <button key={subject.id} type="button" onClick={() => onSelect({ subject: subject.id, topic: null })} aria-pressed={active} className={chip(active, !value)}>{subject.name} {count(active, value)}</button>;
      })}
      {otherCount || selection.subject === OTHER ? <button type="button" onClick={() => onSelect({ subject: OTHER, topic: null })} aria-pressed={selection.subject === OTHER} title="যেগুলোতে কোনো subject দেওয়া নেই" className={chip(selection.subject === OTHER)}>Other {count(selection.subject === OTHER, otherCount)}</button> : null}
    </div>

    {selection.subject && selection.subject !== OTHER ? <div className="flex flex-wrap gap-1.5 border-l-2 border-indigo-200 pl-2.5" role="group" aria-label="Topic">
      <button type="button" onClick={() => onSelect({ subject: selection.subject, topic: null })} aria-pressed={!selection.topic} className={chip(!selection.topic)}>সব topic</button>
      {subjectTopics.map((topic) => {
        const active = selection.topic === topic.id;
        const value = countFor({ subject: selection.subject, topic: topic.id });
        return <button key={topic.id} type="button" onClick={() => onSelect({ subject: selection.subject, topic: topic.id })} aria-pressed={active} className={chip(active, !value)}>{topic.path} {count(active, value)}</button>;
      })}
      {(() => {
        const value = countFor({ subject: selection.subject, topic: NO_TOPIC });
        const active = selection.topic === NO_TOPIC;
        return value || active ? <button type="button" onClick={() => onSelect({ subject: selection.subject, topic: NO_TOPIC })} aria-pressed={active} className={chip(active)}>Topic নেই {count(active, value)}</button> : null;
      })()}
      {!subjectTopics.length ? <span className="self-center text-xs text-zinc-400">এই subject-এ এখনো topic নেই (Subjects পাতা থেকে যোগ করা যায়)</span> : null}
    </div> : null}
  </div>;
}

/** A Topic picker for forms: the chosen subject's topics, nested ones shown as "Parent › Child". */
export function TopicSelect({ subjectId, topics, value, onChange, className }: { subjectId: string; topics: TopicNode[]; value: string; onChange: (topicId: string) => void; className?: string }) {
  const options = subjectId ? topicsOf(subjectId, topics) : [];
  return <select value={options.some((topic) => topic.id === value) ? value : ""} onChange={(event) => onChange(event.target.value)} disabled={!subjectId || !options.length} aria-label="Topic" className={className}>
    <option value="">{!subjectId ? "আগে subject বেছে নাও" : options.length ? "Topic (ইচ্ছা হলে)" : "এই subject-এ topic নেই"}</option>
    {options.map((topic) => <option key={topic.id} value={topic.id}>{topic.path}</option>)}
  </select>;
}
