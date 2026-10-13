# Question Bank — plan

Status: **built 2026-10-13; migration `20261018000000_question_bank` applied to Neon the same day.
Not yet checked in a browser with a real sheet.** Progress goes in `CLAUDE.md` → Feature status.

A shared bank of past exam MCQs, free for everyone. The super admin uploads it from the owner's
sheet; users browse **sets** and send a set to their own **Preliminary**, where the studying and
the exam happen.

---

## 1. Decisions (owner, 2026-10-13)

| Question | Answer |
|---|---|
| Tabs | Three: **BCS**, **প্রাইমারি**, **১১–২০ গ্রেড**. |
| What the bank shows | **Only sets** — one per exam session (e.g. "গণপূর্ত অধিদপ্তর (2025)"). No Todo/Doing/Testing/Done, no exam in the bank. |
| How users practise | "Preliminary-তে পাঠাও" copies the set into their Preliminary (Todo, dated today). Study and exam happen there, as with any Preliminary set. |
| Reading in the bank | "দেখো" shows every question with the answer, solution and explanation. |
| Sending twice | One copy per user per bank set; the button turns into "Preliminary-তে আছে". Deleting the copy allows sending again. |
| Where the copy lands | The subject its questions share (from "সব উৎস", e.g. English › English Grammar); a past paper mixing subjects goes under its section ("বিগত সালের প্রশ্ন"). Subjects are matched by name or created, like accepted shares. |
| Who uploads / deletes | The **super admin** only (`isSuperAdminEmail`). |
| Five options, solution, explanation | Kept, and carried into the Preliminary copy (Preliminary questions now allow 4–5 options and store both). |

A copy is frozen: fixing a question in the bank later doesn't change copies already sent.

## 2. The owner's sheet (new format)

`#`, `পরীক্ষা (Exam)`, `ধরন (Section)`, `সেশন/বিষয় (Session/Subject)`, `প্রশ্নের ধরন`,
`ক্রম (Serial)`, `প্রশ্ন (Question)`, `ক`, `খ`, `গ`, `ঘ`, `অতিরিক্ত অপশন`, `সঠিক উত্তর (Letter)`,
`সঠিক উত্তর (Answer)`, `সমাধান (Solution)`, `ব্যাখ্যা (Explanation)`, `সব উৎস (All sources)`.

Assumed until the owner says otherwise (all in `src/lib/question-bank.ts`, unit-tested):

- **No ID column** → a question is identified by a fingerprint (hash of its wording and options)
  inside its set. Re-uploading the same sheet updates instead of duplicating; but editing a
  question's wording makes it a new question (the old one stays — delete the set and re-upload to
  clean up).
- The exam tab comes from the `পরীক্ষা` text (`bcs/বিসিএস`, `primary/প্রাইমারি/প্রাথমিক`,
  `grade/গ্রেড/11-20`); anything else is a row error.
- `অতিরিক্ত অপশন` is a fifth option **ঙ**; the letter may be ক–ঙ, a–e, 1–5 or Bangla digits.
- A solution starting with "সঠিক উত্তর: <answer>" loses that lead-in (the answer is shown anyway).
- Rows whose `প্রশ্নের ধরন` isn't an MCQ (`বহুনির্বাচনি`/MCQ) are skipped and counted.
- If the answer-text column disagrees with the option the letter points to, it's a **warning**
  (the letter is used).

## 3. Data model

- `BankSet` (exam, section, name = session; unique together) → `BankQuestion` (serial, text,
  options 4–5, correctIndex, solution, explanation, sources, fingerprint; unique per set).
- `QuestionSet.bankSetId` (SetNull) with a unique `(userId, bankSetId)` index: one copy per user,
  and two taps at once can't make two.
- `Question.solution` / `Question.explanation` (nullable). Hidden during a test, like the answer.

## 4. Code

- `src/lib/question-bank.ts`: column mapping by header, row checks, letters, exam names,
  fingerprint, subject placement.
- `src/server/actions/question-bank.ts`: `listBankSets`, `getBankSet`,
  `sendBankSetToPreliminary`; super admin `importBankRows` (150 rows per call), `listAllBankSets`,
  `deleteBankSet`.
- Pages, nested card grids: `/question-bank` (exams) → `/question-bank/[exam]` (sections) →
  `/question-bank/[exam]/[section]` (sets, with search) → `…/[setId]`
  (read-only set); `/admin/question-bank` (upload + set list). Nav: "প্রশ্ন ব্যাংক" for all,
  "Bank upload" for the super admin; voice page `question_bank`.
- Upload: the `.xlsx` is read **in the browser** (`read-excel-file`); every row is checked and
  errors/warnings listed by sheet row before anything is sent.
- **The same data never goes in twice** (owner, 2026-10-13): before uploading, the page asks the
  server (`checkBankRows`) which questions the bank already has and compares a hash of the stored
  row. Each row is shown as new / edited (will update) / already there (skipped); a question
  repeated inside the same file is taken once. Only new and edited rows are sent (batches of 150);
  when nothing is new the upload button is replaced by "সব প্রশ্ন আগেই ব্যাংকে আছে". Stopping
  halfway is safe — uploading again continues without duplicates.
- Set list on the upload page: filter by exam, tick sets or "সব বাছো", delete the ticked ones
  together (`deleteBankSets`). Copies already sent to Preliminary stay.

## 4b. Admin editing and AI clean-up (owner, 2026-10-13)

The owner's sheet came from copying rendered math off a website, so each formula appears two or
three times ("x−1x=1x - \frac{1}{x} = 1x−1=1"). Rules can't untangle that; AI can.

- On a set page, admins and the super admin get: per question ✨ (AI tidies it and fills the
  editor — check, then save) and ✏️ (edit by hand: question, 4–5 options, right answer, solution,
  explanation, with a live book-style preview); for the set, "সব AI দিয়ে গোছাও" or pick some
  ("বাছাই করো") — saved at once, 4 per AI call, with "আগের অবস্থায় ফেরাও" for the whole run.
- `POST /api/question-bank/beautify` (admins, `checkAi`, feature `bank_beautify`): removes the
  duplicated copies, writes math as `$LaTeX$`, lays the solution out step by step. The AI never
  changes the right answer (kept from the original) or the number of options (answers that do are
  dropped); a solution/explanation it leaves out is kept.
- `BankQuestion.editedAt`: set by any admin edit or AI save. Uploading the sheet again never
  overwrites such a question (it shows as "অ্যাপে edit করা"); its fingerprint stays the sheet's, so
  the row is still recognised and not added twice.
- Copies already sent to Preliminary keep the text they were sent with.

## 4c. Paid features (owner, 2026-10-13)

- **Solutions and explanations** are for users with a running plan (`getPlanStatus().active`) —
  in the bank, in Preliminary (study and result) alike. **Sending a set to Preliminary** needs a
  plan too. Admins and the super admin always have both.
- One server check, `hasPremium` (`src/server/premium.ts`); `gateNotes` strips the text before it
  leaves the server and keeps only `hasSolution` / `hasExplanation`, so the page can show a locked
  button. `sendBankSetToPreliminary` refuses without a plan.
- Shown as two buttons, **সমাধান** and **ব্যাখ্যা**, closed at first; a tap opens that one. Locked
  ones show a lock and a link to Plans.
- Editing a Preliminary set without a plan keeps its stored solutions (the editor never saw them).

## 5. Not built (from the first plan, dropped or later)

Exam inside the bank, bookmarks, AI explanations, AI math clean-up, CSV upload, column-mapping
dropdowns (headers are matched automatically), undo-an-upload (delete the set instead).
