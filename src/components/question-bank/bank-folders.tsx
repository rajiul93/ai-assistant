"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, BookMarked, FolderOpen, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { createBankCategory, deleteBankCategory, renameBankCategory } from "@/server/actions/question-bank";
import { createBankChapter, createBankSubject, deleteBankChapter, deleteBankSubject, moveBankChapter, renameBankChapter, renameBankSubject } from "@/server/actions/question-bank-general";
import { adminButton, ConfirmDelete, iconButton, MoveDialog, NameDialog, useBankRun } from "./bank-admin";
import { BankEmpty, BankTile, tileGrid } from "./bank-nav";

/**
 * The folder levels of the Question Bank — subjects, chapters, categories — as card grids. Staff
 * (the `question_bank` permission) also add, rename, move and delete from here.
 */

type Folder = { id: string; title: string; detail: string; href: string; deletable?: boolean; deleteNote?: string };
type Editing = { kind: "add" } | { kind: "rename"; folder: Folder } | { kind: "delete"; folder: Folder } | { kind: "move"; folder: Folder } | null;

const tones = ["bg-indigo-50 text-indigo-700", "bg-emerald-50 text-emerald-700", "bg-amber-50 text-amber-800", "bg-sky-50 text-sky-700", "bg-rose-50 text-rose-700", "bg-violet-50 text-violet-700"];

function FolderGrid({ folders, canEdit, icon, noun, empty, onAdd, onRename, onDelete, move }: {
  folders: Folder[];
  canEdit: boolean;
  icon: typeof FolderOpen;
  noun: string;
  empty: string;
  onAdd: (name: string) => Promise<unknown>;
  onRename: (id: string, name: string) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  move?: { title: string; targets: Array<{ id: string; label: string }>; onMove: (id: string, target: string) => Promise<unknown> };
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const { busy, run } = useBankRun();
  const close = () => setEditing(null);

  return <div className="space-y-3">
    {canEdit ? <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-violet-200 bg-violet-50/80 p-3">
      <span className="mr-auto text-xs font-semibold text-violet-900">Admin</span>
      <button type="button" onClick={() => setEditing({ kind: "add" })} className={adminButton}><Plus className="size-4" /> {noun} যোগ করো</button>
    </div> : null}

    {folders.length ? <div className={tileGrid}>
      {folders.map((folder, index) => <BankTile key={folder.id} href={folder.href} icon={icon} tone={tones[index % tones.length]} title={folder.title} detail={folder.detail}
        actions={canEdit ? <>
          <button type="button" onClick={() => setEditing({ kind: "rename", folder })} aria-label={`${folder.title} নাম বদলাও`} title="নাম বদলাও" className={iconButton}><Pencil className="size-3.5" /></button>
          {move ? <button type="button" onClick={() => setEditing({ kind: "move", folder })} aria-label={`${folder.title} সরাও`} title="অন্য জায়গায় সরাও" className={iconButton}><ArrowRightLeft className="size-3.5" /></button> : null}
          {folder.deletable !== false ? <button type="button" onClick={() => setEditing({ kind: "delete", folder })} aria-label={`${folder.title} মুছো`} title="মুছো" className={`${iconButton} hover:bg-red-50 hover:text-red-600`}><Trash2 className="size-3.5" /></button> : null}
        </> : null} />)}
    </div> : <BankEmpty icon={icon} text={empty} />}

    <NameDialog open={editing?.kind === "add"} onOpenChange={(open) => !open && close()} title={`নতুন ${noun}`} label={`${noun}-এর নাম`} busy={busy}
      onSubmit={(name) => run(() => onAdd(name), `${noun} যোগ হলো`, close)} />
    <NameDialog open={editing?.kind === "rename"} onOpenChange={(open) => !open && close()} title="নাম বদলাও" label={`${noun}-এর নাম`} initial={editing?.kind === "rename" ? editing.folder.title : ""} busy={busy}
      onSubmit={(name) => editing?.kind === "rename" && run(() => onRename(editing.folder.id, name), "নাম বদলানো হলো", close)} />
    <ConfirmDelete open={editing?.kind === "delete"} onOpenChange={(open) => !open && close()} busy={busy}
      title={`"${editing?.kind === "delete" ? editing.folder.title : ""}" মুছবে?`}
      description={editing?.kind === "delete" ? editing.folder.deleteNote ?? `${editing.folder.detail} — সব মুছে যাবে, ফেরানো যাবে না।` : ""}
      onConfirm={() => editing?.kind === "delete" && run(() => onDelete(editing.folder.id), "মুছে ফেলা হলো", close)} />
    {move ? <MoveDialog open={editing?.kind === "move"} onOpenChange={(open) => !open && close()} title={move.title} targets={move.targets} busy={busy}
      onSubmit={(target) => editing?.kind === "move" && run(() => move.onMove(editing.folder.id, target), "সরানো হলো", close)} /> : null}
  </div>;
}

export function SubjectGrid({ subjects, canEdit }: { subjects: Array<{ id: string; name: string; chapters: number }>; canEdit: boolean }) {
  const router = useRouter();
  return <FolderGrid canEdit={canEdit} icon={BookMarked} noun="Subject" empty="এখনো কোনো subject নেই।"
    folders={subjects.map((subject) => ({ id: subject.id, title: subject.name, detail: subject.chapters ? `${subject.chapters}টি chapter` : "Chapter নেই", href: `/question-bank/general/${subject.id}` }))}
    onAdd={async (name) => { const { id } = await createBankSubject(name); router.push(`/question-bank/general/${id}`); }}
    onRename={renameBankSubject} onDelete={deleteBankSubject} />;
}

export function ChapterGrid({ subjectId, chapters, others, canEdit }: { subjectId: string; chapters: Array<{ id: string; name: string; articles: number; mcqs: number; shorts: number }>; others: Array<{ id: string; name: string }>; canEdit: boolean }) {
  const router = useRouter();
  const detail = (chapter: (typeof chapters)[number]) => [chapter.articles && `${chapter.articles} article`, chapter.mcqs && `${chapter.mcqs} MCQ`, chapter.shorts && `${chapter.shorts} short`].filter(Boolean).join(" · ") || "এখনো খালি";
  return <FolderGrid canEdit={canEdit} icon={FolderOpen} noun="Chapter" empty="এই subject-এ এখনো কোনো chapter নেই।"
    folders={chapters.map((chapter) => ({ id: chapter.id, title: chapter.name, detail: detail(chapter), href: `/question-bank/general/${subjectId}/${chapter.id}` }))}
    onAdd={async (name) => { const { id } = await createBankChapter(subjectId, name); router.push(`/question-bank/general/${subjectId}/${id}`); }}
    onRename={renameBankChapter} onDelete={deleteBankChapter}
    move={{ title: "Chapter-টা কোন subject-এ যাবে?", targets: others.map((subject) => ({ id: subject.id, label: subject.name })), onMove: moveBankChapter }} />;
}

export function CategoryGrid({ categories, canEdit }: { categories: Array<{ id: string; name: string; slug: string; exam: string | null; sets: number; questions: number }>; canEdit: boolean }) {
  const router = useRouter();
  return <FolderGrid canEdit={canEdit} icon={Landmark} noun="Category" empty="এখনো কোনো category নেই।"
    folders={categories.map((category) => ({
      id: category.id, title: category.name, href: `/question-bank/previous/${category.slug}`,
      detail: category.sets ? `${category.sets}টি set · ${category.questions}টি প্রশ্ন` : "এখনো যোগ হয়নি",
      // The three exams carry the plan prices; a category with sets would lose them.
      deletable: !category.exam && !category.sets,
      deleteNote: "খালি category — মুছে ফেললে আর দেখা যাবে না।",
    }))}
    onAdd={async (name) => { const { slug } = await createBankCategory(name); router.push(`/question-bank/previous/${slug}`); }}
    onRename={renameBankCategory} onDelete={deleteBankCategory} />;
}
