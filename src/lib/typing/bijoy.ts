// Bijoy keyboard: every Bijoy variant (Classic/ANSI, ৭১, Unicode) shares this key map;
// they differ only in the output encoding and font, not in the keys you press.
export const bijoyKeyMap: Record<string, string> = {
  q: "ঙ", Q: "ং", w: "য", W: "য়", e: "ড", E: "ঢ", r: "প", R: "ফ", t: "ট", T: "ঠ", y: "চ", Y: "ছ",
  u: "জ", U: "ঝ", i: "হ", I: "ঞ", o: "গ", O: "ঘ", p: "ড়", P: "ঢ়",
  a: "ৃ", A: "র্", s: "ু", S: "ূ", d: "ি", D: "ী", f: "া", F: "অ", g: "্", G: "।",
  h: "ব", H: "ভ", j: "ক", J: "খ", k: "ত", K: "থ", l: "দ", L: "ধ",
  z: "্র", Z: "্য", x: "ও", X: "ৗ", c: "ে", C: "ৈ", v: "র", V: "ল", b: "ন", B: "ণ", n: "স", N: "ষ", m: "ম", M: "শ",
  "\\": "ৎ", "|": "ঃ", "&": "ঁ",
  0: "০", 1: "১", 2: "২", 3: "৩", 4: "৪", 5: "৫", 6: "৬", 7: "৭", 8: "৮", 9: "৯",
};

// হসন্ত (g) followed by a kar gives the independent vowel.
const karToVowel: Record<string, string> = { "া": "আ", "ি": "ই", "ী": "ঈ", "ু": "উ", "ূ": "ঊ", "ৃ": "ঋ", "ে": "এ", "ৈ": "ঐ", "ৗ": "ঔ" };
const preKars = new Set(["ি", "ে", "ৈ"]);
const consonant = "[ক-হৎড়-য়]়?";
const isConsonant = (text: string) => new RegExp(`^${consonant}$`).test(text);

// "kar": a pre-kar (ি ে ৈ) was typed first and waits for its consonant;
// "base": the consonant arrived, joiners (্র ্য ্) may still attach before the kar;
// "joiner": a হসন্ত was slipped in before the kar and waits for the next consonant.
export type BijoyPending = "none" | "kar" | "base" | "joiner";
export type BijoyState = { text: string; pending: BijoyPending };

const insertBeforeLast = (text: string, value: string) => text.slice(0, -1) + value + text.slice(-1);

export function applyBijoyKey({ text, pending }: BijoyState, key: string): BijoyState | null {
  const out = bijoyKeyMap[key];
  if (!out) return null;
  if (pending === "kar" && isConsonant(out)) return { text: insertBeforeLast(text, out), pending: "base" };
  if (pending === "base" && (out === "্র" || out === "্য")) return { text: insertBeforeLast(text, out), pending: "base" };
  if (pending === "base" && out === "্") return { text: insertBeforeLast(text, out), pending: "joiner" };
  if (pending === "joiner" && isConsonant(out)) return { text: insertBeforeLast(text, out), pending: "base" };
  if (text.endsWith("্") && karToVowel[out]) return { text: text.slice(0, -1) + karToVowel[out], pending: "none" };
  if (text.endsWith("ে") && out === "া") return { text: text.slice(0, -1) + "ো", pending: "none" };
  if (text.endsWith("ে") && out === "ৗ") return { text: text.slice(0, -1) + "ৌ", pending: "none" };
  if (out === "র্") {
    // Reph is typed after the consonant cluster it sits on, e.g. ধর্ম = L m A.
    const match = text.match(new RegExp(`(?:${consonant}্)*${consonant}[া-ৌৗ]*$`));
    if (match?.index !== undefined) return { text: text.slice(0, match.index) + out + text.slice(match.index), pending: "none" };
  }
  return { text: text + out, pending: preKars.has(out) ? "kar" : "none" };
}

export function typeBijoyKeys(keys: string[]) {
  let state: BijoyState = { text: "", pending: "none" };
  for (const key of keys) state = applyBijoyKey(state, key) ?? { text: state.text + key, pending: "none" };
  return state.text;
}

// Keys (as characters, e.g. ["g", "f"]) that produce a single Bangla letter or sign.
export function bijoySequence(char: string): string[] | null {
  const direct = Object.keys(bijoyKeyMap).find((key) => bijoyKeyMap[key] === char);
  if (direct) return [direct];
  if (char === "ো") return ["c", "f"];
  if (char === "ৌ") return ["c", "X"];
  const kar = Object.keys(karToVowel).find((key) => karToVowel[key] === char);
  const karKeys = kar ? bijoySequence(kar) : null;
  return karKeys ? ["g", ...karKeys] : null;
}

const shiftedSymbols: Record<string, string> = { "|": "\\", "&": "7" };

// Physical key + whether Shift is held, for the keyboard guide.
export function physicalKey(key: string) {
  if (shiftedSymbols[key]) return { label: shiftedSymbols[key], shift: true };
  return { label: key.toUpperCase(), shift: /[A-Z]/.test(key) };
}

export const formatKey = (key: string) => {
  const { label, shift } = physicalKey(key);
  return shift ? `Shift+${label}` : label;
};
