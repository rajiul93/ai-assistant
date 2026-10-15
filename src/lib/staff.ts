/**
 * What a staff member (role ADMIN) may do. The super admin can do everything; a USER nothing.
 * Being staff on its own (any permission or none) still means no AI limits, every exam open and
 * the voice features — permissions only decide which admin work they may do.
 */
export const STAFF_PERMISSIONS = [
  { id: "billing", label: "Billing", hint: "পেমেন্ট দেখা, approve বা reject করা" },
  { id: "customers", label: "Customers", hint: "কাস্টমার তালিকা; block, AI বন্ধ, subscription cancel" },
  { id: "question_bank", label: "প্রশ্ন ব্যাংক", hint: "সেট upload, প্রশ্ন edit, AI দিয়ে গোছানো ও সমাধান লেখা" },
  { id: "vocabulary", label: "শব্দভান্ডার", hint: "সবার জন্য শব্দ যোগ, বদল, মোছা" },
  { id: "staff", label: "Staff manage", hint: "staff যোগ বা বাদ দেওয়া, তাদের permission ঠিক করা" },
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number]["id"];

export const ALL_PERMISSIONS: StaffPermission[] = STAFF_PERMISSIONS.map((item) => item.id);

/** Keeps only known permission ids (the database column is plain text). */
export function cleanPermissions(values: readonly string[] | null | undefined): StaffPermission[] {
  return ALL_PERMISSIONS.filter((id) => values?.includes(id));
}

/**
 * A manager's change to someone's permissions: only the ones the manager holds change (to what was
 * asked); every other one stays as it was, so nobody can give or take away more than they have.
 */
export function mergePermissions(current: readonly StaffPermission[], requested: readonly StaffPermission[], mine: readonly StaffPermission[]): StaffPermission[] {
  return ALL_PERMISSIONS.filter((id) => (mine.includes(id) ? requested.includes(id) : current.includes(id)));
}
