# Question Bank v2 — General + বিগত বছরের প্রশ্ন (2026-10-16)

The first version ([question-bank-plan.md](question-bank-plan.md)) was one level of past papers per
exam. The owner asked for two halves:

```
প্রশ্ন ব্যাংক
├── General → Subject → Chapter → Article / MCQ / Short Question
└── বিগত বছরের প্রশ্ন → Category (BCS, প্রাইমারি, ১১–২০ গ্রেড, + admin-added) → Year → Set
```

## Owner's answers

1. **Content entry: both.** In-app forms (article in the Quill editor like notes; MCQ and Short
   Question forms) and an Excel upload per chapter for MCQ / Short Questions.
2. **MCQ practice: read in the bank + send.** Users read chapter MCQs with answers in the bank and
   can send a chapter's MCQs to their Preliminary (Short Questions to Short Question) as one set.
3. **Free/paid per item.** Defaults: Article free, MCQ and Short Question paid. Staff with the
   `question_bank` permission toggle each article, MCQ, short question or whole past-year set.
4. **Old sets** all go under বিগত বছরের প্রশ্ন → their exam → the year in the name ("(2025)", Bangla
   digits too), or "অন্যান্য" when there is none. Admins can change the year or move a set.

## Data

- `BankCategory` (name, slug, sortOrder, `exam BankExam? @unique`). The three built-ins are seeded
  by the migration with fixed ids and keep their `exam`, so pricing stays as it was
  (`canOpenExam` → the exam's `ExamTrack`). Admin-added categories have no exam: any running plan.
- `BankSet` + `categoryId` (required), `year Int?`, `free`. `exam` became nullable and is kept as a
  mirror of the category's exam (the sheet upload still finds sets by exam). The unique key moved
  from (exam, section, name) to (categoryId, section, name).
- `BankSubject` → `BankChapter` (short `name` + optional `description`, shown under it on the card — owner, 2026-10-17) → `BankArticle` (HTML, sanitized; `free` default true),
  `BankQuestion` (now either in a set **or** a chapter — CHECK constraint; `free` default false),
  `BankShortQuestion` (`free` default false). Chapter MCQ / short questions dedupe by fingerprint.
- The migration seeds five subjects (বাংলা, ইংরেজি, গণিত, সাধারণ জ্ঞান, বিজ্ঞান) with no chapters.

## Access (server side — `src/server/bank-access.ts`)

- Past-year set: `free`, else the category's exam in a running plan (`canOpenExam`), else (admin
  category) any running plan. Without access the page gets only the first 3 questions as a preview.
- Chapter items: `free`, else any running plan (`hasPremium`). A locked item reaches the page as
  `{ id, locked: true }` only. Staff always pass.
- Sending to Preliminary / Short Question copies only the items the user may open.

## Limits (owner, 2026-10-16)

- **Without a plan:** any **3** past-year sets of the user's own choosing open in full (with
  solutions) for good — `BankSetUnlock`, button "এই set খোলো" on a locked set's page. Reading only:
  nothing goes to Preliminary / Short Question without a running plan.
- **With a plan:** at most **2** sets taken from the bank at a time per kind (Preliminary: past-year
  sets and chapter MCQs; Short Question: chapter short questions). A set stops counting once any of
  its tests scores **60%** or more, or the user deletes it. Marked by `fromBank` on
  `QuestionSet` / `ShortQuestionSet` (existing bank copies were backfilled), checked in
  `assertCanTakeFromBank` (`src/server/bank-access.ts`). Sets users make themselves have no limit;
  staff have none either.

## Admin (permission `question_bank`)

Add / rename / delete subjects, chapters and (admin-added) categories; add / edit / delete articles,
MCQs and short questions; toggle free; move items to another chapter, chapters to another subject,
sets to another category (a duplicate in the target is skipped and reported).

## Paste with AI (owner, 2026-10-16)

On a chapter's MCQ and Short Question tabs staff can also **paste** text copied from anywhere.
`/api/question-bank/paste` (staff only; one paste = one AI use via a shared `batch` ref) sorts it
into question / options / answer / solution word for word, in pieces of ~6000 characters
(`chunkPastedText`). An answer that isn't in the text stays empty — the AI never picks one; the
admin taps the right option (or types the answer) in the preview, and only checked items are saved
through `importChapterRows` (duplicates skipped; Free optional).

## Past-year sets into chapters, with a duplicate check (owner, 2026-10-16)

Many old "sets" are really topics (English Grammar, Vocabulary…, under "অন্যান্য"). Staff move a
whole set into a General chapter (or a new chapter named after it under any subject) from the set
card (`MoveToChapter`); single MCQs move the same way. Before anything moves,
`/api/question-bank/duplicates` compares each question with the chapter: same fingerprint = exact
copy; the rest go to AI (25 per call, against up to 600 of the chapter's questions, low
reasoning) for "same question, same answer, worded differently". The admin sees each duplicate
beside the one already there and can keep an AI-flagged one ("তবুও আনো"); exact copies are always
left out. `moveQuestionsToChapter` then moves the rest and, for a whole set, deletes the set
(users' Preliminary copies stay).

## Routes

`/question-bank` (two cards) · `/question-bank/general` · `/general/[subjectId]` ·
`/general/[subjectId]/[chapterId]?tab=` · `/question-bank/previous` · `/previous/[slug]` ·
`/previous/[slug]/[setId]`. The old `/question-bank/[exam]/…` URLs redirect.
