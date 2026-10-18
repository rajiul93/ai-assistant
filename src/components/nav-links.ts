import {
  Contact,
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  Gauge,
  HandCoins,
  Keyboard,
  Languages,
  LayoutDashboard,
  Library,
  LibraryBig,
  ListTodo,
  MessageCircle,
  MessageSquareText,
  MonitorPlay,
  NotebookPen,
  Receipt,
  Share2,
  TrendingUp,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { StaffPermission } from "@/lib/staff";

/** Every signed-in page, for the sidebar, the phone "More" sheet and the page search. */
export type NavLink = { href: string; label: string; short: string; icon: LucideIcon };

export const links: NavLink[] = [
  { href: "/dashboard", label: "Home", short: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", short: "Tasks", icon: ListTodo },
  { href: "/subjects", label: "Subjects", short: "Subjects", icon: BookOpen },
  { href: "/progress", label: "Progress", short: "Progress", icon: TrendingUp },
  { href: "/plan", label: "Study Plan", short: "Plan", icon: CalendarClock },
  { href: "/notes", label: "Notes", short: "Notes", icon: NotebookPen },
  { href: "/preliminary", label: "Preliminary", short: "Preliminary", icon: ClipboardCheck },
  { href: "/short-questions", label: "Short Question", short: "Short Q", icon: MessageSquareText },
  { href: "/question-bank", label: "প্রশ্ন ব্যাংক", short: "প্রশ্ন ব্যাংক", icon: Library },
  { href: "/confusions", label: "Confusion", short: "Confusion", icon: CircleHelp },
  { href: "/videos", label: "ভিডিও", short: "ভিডিও", icon: MonitorPlay },
  { href: "/vocabulary", label: "Vocabulary", short: "Vocabulary", icon: Languages },
  { href: "/typing", label: "Typing Lab", short: "Typing", icon: Keyboard },
  { href: "/messages", label: "Messages", short: "Messages", icon: MessageCircle },
  { href: "/jobs", label: "Jobs", short: "Jobs", icon: BriefcaseBusiness },
  { href: "/usage", label: "AI Usage", short: "AI Usage", icon: Gauge },
  { href: "/billing", label: "Plans", short: "Plans", icon: CreditCard },
  { href: "/affiliate", label: "রেফার করে আয়", short: "রেফার করে আয়", icon: Share2 },
  { href: "/profile", label: "Profile", short: "Profile", icon: UserRound },
];

export const billingAdminLink: NavLink = { href: "/admin/billing", label: "Billing", short: "Billing", icon: Receipt };
export const staffLink: NavLink = { href: "/admin/staff", label: "Staff", short: "Staff", icon: UsersRound };
export const customersLink: NavLink = { href: "/admin/customers", label: "Customers", short: "Customers", icon: Contact };
export const bankUploadLink: NavLink = { href: "/admin/question-bank", label: "Bank upload", short: "Bank upload", icon: LibraryBig };
export const affiliatesAdminLink: NavLink = { href: "/admin/affiliates", label: "Affiliates", short: "Affiliates", icon: HandCoins };

/** The admin pages this user may open, from their staff permissions (src/lib/staff.ts). */
export const adminLinksFor = (permissions: readonly StaffPermission[]) => [
  ...(permissions.includes("billing") ? [billingAdminLink, affiliatesAdminLink] : []),
  ...(permissions.includes("customers") ? [customersLink] : []),
  ...(permissions.includes("staff") ? [staffLink] : []),
  ...(permissions.includes("question_bank") ? [bankUploadLink] : []),
];

/** Bangla and English words people search pages by, beyond the label. */
export const searchWords: Record<string, string> = {
  "/dashboard": "home হোম ড্যাশবোর্ড",
  "/tasks": "task টাস্ক কাজ timer টাইমার",
  "/subjects": "subject বিষয় সাবজেক্ট topic",
  "/progress": "progress প্রগতি অগ্রগতি",
  "/plan": "study plan স্টাডি প্ল্যান পরিকল্পনা বয়স age",
  "/notes": "notes নোট নোটস",
  "/preliminary": "preliminary প্রিলিমিনারি mcq এমসিকিউ model test মডেল টেস্ট exam",
  "/short-questions": "short question শর্ট প্রশ্ন লিখিত",
  "/question-bank": "question bank প্রশ্ন ব্যাংক বিগত সালের প্রশ্ন",
  "/confusions": "confusion কনফিউশন",
  "/videos": "video ভিডিও youtube ইউটিউব class ক্লাস lecture লেকচার",
  "/vocabulary": "vocabulary ভোকাবুলারি শব্দ verb",
  "/typing": "typing টাইপিং",
  "/messages": "messages মেসেজ friend বন্ধু chat চ্যাট group গ্রুপ",
  "/jobs": "jobs জব চাকরি application আবেদন",
  "/usage": "ai usage token টোকেন",
  "/billing": "plans billing প্ল্যান কেনা package প্যাকেজ",
  "/affiliate": "refer earn রেফার আয় affiliate অ্যাফিলিয়েট refer রেফার link লিংক commission কমিশন আয়",
  "/profile": "profile প্রোফাইল নাম phone ফোন",
};

/** Each page's own colour (a gradient), the same in the sidebar and the phone "More" sheet. */
const TONES: Record<string, string> = {
  "/dashboard": "from-blue-400 to-blue-600",
  "/tasks": "from-indigo-400 to-blue-600",
  "/notes": "from-orange-400 to-amber-500",
  "/jobs": "from-teal-400 to-emerald-600",
  "/subjects": "from-sky-400 to-blue-600",
  "/progress": "from-emerald-400 to-teal-600",
  "/plan": "from-violet-400 to-purple-600",
  "/videos": "from-rose-400 to-red-500",
  "/typing": "from-slate-500 to-slate-700",
  "/preliminary": "from-blue-400 to-indigo-600",
  "/short-questions": "from-cyan-400 to-sky-600",
  "/question-bank": "from-amber-400 to-orange-500",
  "/confusions": "from-fuchsia-400 to-pink-600",
  "/vocabulary": "from-lime-400 to-green-600",
  "/messages": "from-blue-500 to-indigo-600",
  "/usage": "from-orange-400 to-amber-600",
  "/billing": "from-yellow-400 to-amber-500",
  "/affiliate": "from-emerald-400 to-teal-600",
  "/profile": "from-slate-400 to-slate-600",
  "/admin/billing": "from-emerald-500 to-green-700",
  "/admin/customers": "from-pink-400 to-rose-600",
  "/admin/staff": "from-indigo-400 to-violet-600",
  "/admin/question-bank": "from-orange-400 to-red-500",
  "/admin/affiliates": "from-teal-400 to-cyan-600",
};

export const toneOf = (href: string) => TONES[href] ?? "from-blue-400 to-blue-600";

/**
 * Pages in groups, four to a group where possible so the phone sheet's rows fill. The phone tab
 * bar holds Home, Tasks, Notes and Jobs; the sidebar lists them first as "মূল".
 */
export const NAV_GROUPS: Array<{ title: string; hrefs: string[] }> = [
  { title: "পড়াশোনা", hrefs: ["/subjects", "/plan", "/progress", "/typing"] },
  { title: "প্রশ্ন ও অনুশীলন", hrefs: ["/preliminary", "/short-questions", "/question-bank", "/confusions"] },
  { title: "আরো", hrefs: ["/videos", "/vocabulary", "/messages"] },
];

/**
 * Account pages: on the phone they ride on the profile card (except "রেফার করে আয়", a tile under
 * "আরো"), in the sidebar they are a group.
 */
export const ACCOUNT_LINKS = [
  { href: "/billing", label: "আমার প্ল্যান" },
  { href: "/usage", label: "AI ব্যবহার" },
  { href: "/affiliate", label: "রেফার করে আয়" },
];
