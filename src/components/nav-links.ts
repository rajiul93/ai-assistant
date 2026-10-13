import {
  BookOpen,
  BriefcaseBusiness,
  CalendarClock,
  CircleHelp,
  ClipboardCheck,
  CreditCard,
  Gauge,
  Keyboard,
  Languages,
  LayoutDashboard,
  Library,
  LibraryBig,
  ListTodo,
  MessageCircle,
  MessageSquareText,
  NotebookPen,
  Receipt,
  TrendingUp,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

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
  { href: "/vocabulary", label: "Vocabulary", short: "Vocabulary", icon: Languages },
  { href: "/typing", label: "Typing Lab", short: "Typing", icon: Keyboard },
  { href: "/messages", label: "Messages", short: "Messages", icon: MessageCircle },
  { href: "/jobs", label: "Jobs", short: "Jobs", icon: BriefcaseBusiness },
  { href: "/usage", label: "AI Usage", short: "AI Usage", icon: Gauge },
  { href: "/billing", label: "Plans", short: "Plans", icon: CreditCard },
  { href: "/profile", label: "Profile", short: "Profile", icon: UserRound },
];

export const billingAdminLink: NavLink = { href: "/admin/billing", label: "Billing", short: "Billing", icon: Receipt };
export const rolesLink: NavLink = { href: "/admin/users", label: "Users & roles", short: "Users", icon: UsersRound };
export const bankUploadLink: NavLink = { href: "/admin/question-bank", label: "Bank upload", short: "Bank upload", icon: LibraryBig };

/** The admin pages this user may open. */
export const adminLinksFor = (admin: boolean, superAdmin: boolean) => [...(admin ? [billingAdminLink] : []), ...(superAdmin ? [rolesLink, bankUploadLink] : [])];

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
  "/vocabulary": "vocabulary ভোকাবুলারি শব্দ verb",
  "/typing": "typing টাইপিং",
  "/messages": "messages মেসেজ friend বন্ধু chat চ্যাট group গ্রুপ",
  "/jobs": "jobs জব চাকরি application আবেদন",
  "/usage": "ai usage token টোকেন",
  "/billing": "plans billing প্ল্যান কেনা package প্যাকেজ",
  "/profile": "profile প্রোফাইল নাম phone ফোন",
};
