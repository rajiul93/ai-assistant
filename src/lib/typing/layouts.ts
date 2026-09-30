export type TypingMethod = "bijoy-classic" | "bijoy-71" | "bijoy-unicode";
export type TypingLanguage = "bn" | "en";
export type Finger = "left-pinky" | "left-ring" | "left-middle" | "left-index" | "right-index" | "right-middle" | "right-ring" | "right-pinky";
export type KeyboardKey = { code: string; label: string; finger: Finger };
export type TypingLayout = { id: TypingMethod; name: string; encoding: string; note: string };

// All three use the same Bijoy key map (see bijoy.ts); they differ in output encoding.
export const banglaLayouts: TypingLayout[] = [
  { id: "bijoy-classic", name: "বিজয় Classic", encoding: "ANSI · SutonnyMJ", note: "পুরনো ANSI ফন্ট (SutonnyMJ)। সরকারি অফিস ও পুরনো নথিতে এখনো ব্যবহৃত হয়।" },
  { id: "bijoy-71", name: "বিজয় ৭১", encoding: "Unicode + ANSI", note: "বিজয় একাত্তর — একই কী-বোর্ড, ইউনিকোড ও ANSI দুই মোডেই লেখা যায়।" },
  { id: "bijoy-unicode", name: "বিজয় Unicode", encoding: "Unicode", note: "আধুনিক ইউনিকোড আউটপুট — ওয়েব, ইমেইল ও নিয়োগ পরীক্ষার সফটওয়্যারে ব্যবহৃত হয়।" },
];

export type LessonGroup = { title: string; subtitle: string; items: string[] };

export const lessonGroups: Record<TypingLanguage, LessonGroup[]> = {
  bn: [
    { title: "স্বরবর্ণ", subtitle: "Vowels", items: ["অ", "আ", "ই", "ঈ", "উ", "ঊ", "ঋ", "এ", "ঐ", "ও", "ঔ"] },
    { title: "ব্যঞ্জনবর্ণ", subtitle: "Consonants", items: ["ক", "খ", "গ", "ঘ", "ঙ", "চ", "ছ", "জ", "ঝ", "ঞ", "ট", "ঠ", "ড", "ঢ", "ণ", "ত", "থ", "দ", "ধ", "ন", "প", "ফ", "ব", "ভ", "ম", "য", "র", "ল", "শ", "ষ", "স", "হ", "ড়", "ঢ়", "য়", "ৎ"] },
    { title: "কার ও চিহ্ন", subtitle: "Vowel signs & marks", items: ["া", "ি", "ী", "ু", "ূ", "ৃ", "ে", "ৈ", "ো", "ৌ", "ং", "ঃ", "ঁ", "্", "।"] },
  ],
  en: [
    { title: "Home row", subtitle: "A S D F · J K L", items: "asdfghjkl".split("") },
    { title: "Top row", subtitle: "Q W E R T · Y U I O P", items: "qwertyuiop".split("") },
    { title: "Bottom row", subtitle: "Z X C V B · N M", items: "zxcvbnm".split("") },
  ],
};

// keys are Bijoy keystrokes separated by spaces.
export const conjuncts = [
  { text: "ক্ত", word: "শক্তি", keys: "j g k" }, { text: "ক্র", word: "ক্রম", keys: "j z" },
  { text: "ত্র", word: "ত্রাণ", keys: "k z" }, { text: "শ্র", word: "শ্রম", keys: "M z" },
  { text: "জ্ঞ", word: "জ্ঞান", keys: "u g I" }, { text: "ক্ষ", word: "ক্ষমতা", keys: "j g N" },
  { text: "ন্ত", word: "শান্ত", keys: "b g k" }, { text: "স্থ", word: "স্থান", keys: "n g K" },
  { text: "ন্দ", word: "আনন্দ", keys: "b g l" }, { text: "ম্প", word: "সম্পদ", keys: "m g r" },
  { text: "ষ্ট", word: "কষ্ট", keys: "N g t" }, { text: "ঙ্গ", word: "বঙ্গ", keys: "q g o" },
  { text: "ল্য", word: "মূল্য", keys: "V Z" }, { text: "র্ম", word: "ধর্ম", keys: "m A" },
];

export type PracticeLevel = "character" | "word" | "sentence" | "passage";

export const practiceTexts: Record<TypingLanguage, Record<PracticeLevel, string[]>> = {
  bn: {
    character: ["ক খ গ ঘ", "অ আ ই ঈ", "ত থ দ ধ ন", "প ফ ব ভ ম"],
    word: ["বাংলা ভাষা", "সাফল্যের পথে", "নিয়মিত অনুশীলন", "সরকারি চাকরি"],
    sentence: ["নিয়মিত অনুশীলনে টাইপিং গতি বাড়ে।", "পরিশ্রম সাফল্যের চাবিকাঠি।", "সময়ের কাজ সময়ে করা উচিত।"],
    passage: ["বাংলাদেশের সরকারি চাকরির পরীক্ষায় বাংলা টাইপিং একটি গুরুত্বপূর্ণ দক্ষতা। নিয়মিত অনুশীলন, সঠিক আঙুলের অবস্থান এবং নির্ভুলতা দ্রুত টাইপ করতে সাহায্য করে।"],
  },
  en: {
    character: ["asdf jkl", "qwer uiop", "zxcv bnm"],
    word: ["practice makes perfect", "steady hands", "home row keys"],
    sentence: ["Regular practice builds typing speed.", "Accuracy matters more than speed at first."],
    passage: ["Typing is a core skill for government job examinations in Bangladesh. Keep your fingers on the home row, look at the screen instead of the keyboard, and focus on accuracy before speed."],
  },
};

export const testPassages: Record<TypingLanguage, string[]> = {
  bn: [
    "বাংলাদেশ একটি নদীমাতৃক দেশ। পদ্মা, মেঘনা ও যমুনা এদেশের প্রধান নদী। নদীকে ঘিরেই গড়ে উঠেছে এদেশের কৃষি, ব্যবসা ও মানুষের জীবনযাত্রা। বর্ষাকালে নদীগুলো পানিতে ভরে যায় এবং চারদিকে সবুজের সমারোহ দেখা যায়। নিয়মিত অনুশীলন করলে যে কেউ দ্রুত ও নির্ভুলভাবে বাংলা টাইপ করতে পারে।",
    "সরকারি চাকরির প্রস্তুতিতে সময় ব্যবস্থাপনা খুবই গুরুত্বপূর্ণ। প্রতিদিন নির্দিষ্ট সময় পড়াশোনা করলে আত্মবিশ্বাস বাড়ে। কম্পিউটার দক্ষতার অংশ হিসেবে টাইপিং পরীক্ষায় গতি ও নির্ভুলতা দুটোই মূল্যায়ন করা হয়।",
  ],
  en: [
    "The quick brown fox jumps over the lazy dog. Good typists keep their eyes on the screen and let their fingers find the keys by memory. Speed comes naturally once accuracy becomes a habit, so slow down, breathe, and type every word correctly.",
    "Government recruitment tests often include a typing section. Candidates are judged on words per minute and on accuracy. Practising a little every day is far more effective than a long session once a week.",
  ],
};

export const keyboardRows: KeyboardKey[][] = [
  [
    { code: "KeyQ", label: "Q", finger: "left-pinky" }, { code: "KeyW", label: "W", finger: "left-ring" }, { code: "KeyE", label: "E", finger: "left-middle" }, { code: "KeyR", label: "R", finger: "left-index" }, { code: "KeyT", label: "T", finger: "left-index" },
    { code: "KeyY", label: "Y", finger: "right-index" }, { code: "KeyU", label: "U", finger: "right-index" }, { code: "KeyI", label: "I", finger: "right-middle" }, { code: "KeyO", label: "O", finger: "right-ring" }, { code: "KeyP", label: "P", finger: "right-pinky" },
  ],
  [
    { code: "KeyA", label: "A", finger: "left-pinky" }, { code: "KeyS", label: "S", finger: "left-ring" }, { code: "KeyD", label: "D", finger: "left-middle" }, { code: "KeyF", label: "F", finger: "left-index" }, { code: "KeyG", label: "G", finger: "left-index" },
    { code: "KeyH", label: "H", finger: "right-index" }, { code: "KeyJ", label: "J", finger: "right-index" }, { code: "KeyK", label: "K", finger: "right-middle" }, { code: "KeyL", label: "L", finger: "right-ring" },
  ],
  [
    { code: "KeyZ", label: "Z", finger: "left-pinky" }, { code: "KeyX", label: "X", finger: "left-ring" }, { code: "KeyC", label: "C", finger: "left-middle" }, { code: "KeyV", label: "V", finger: "left-index" }, { code: "KeyB", label: "B", finger: "left-index" }, { code: "KeyN", label: "N", finger: "right-index" }, { code: "KeyM", label: "M", finger: "right-index" },
  ],
];

export const fingerNames: Record<Finger, string> = {
  "left-pinky": "Left little finger", "left-ring": "Left ring finger", "left-middle": "Left middle finger", "left-index": "Left index finger",
  "right-index": "Right index finger", "right-middle": "Right middle finger", "right-ring": "Right ring finger", "right-pinky": "Right little finger",
};

export const fingerFor = (label: string) => keyboardRows.flat().find((key) => key.label === label)?.finger;
