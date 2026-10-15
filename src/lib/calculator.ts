/**
 * The scientific calculator's maths: a small recursive-descent parser over the expression the
 * keypad builds (never `eval`). Supports + − × ÷ ^, %, !, ( ) [ ] { } brackets, π, e, sin/cos/tan and their
 * inverses (degrees or radians), √, ln, log, and implied multiplication (2π, 3(4), 2sin(30)).
 */
export type AngleMode = "deg" | "rad";

type Token = { type: "num"; value: number } | { type: "id"; value: string } | { type: "op"; value: string };

type Fn = "asin" | "acos" | "atan" | "sin" | "cos" | "tan" | "sqrt" | "ln" | "log";

const OPENERS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/** ( [ { must close with their own kind; closers may be left off at the end, as on phone calculators. */
function checkBrackets(input: string) {
  const stack: string[] = [];
  for (const char of input) {
    if (OPENERS[char]) stack.push(OPENERS[char]);
    else if (char === ")" || char === "]" || char === "}") {
      if (stack.pop() !== char) throw new Error("বন্ধনী মেলেনি");
    }
  }
}

/** `keepBrackets`: leave [ ] { } as they are (for drawing); evaluation reads them all as ( ). */
function tokenize(input: string, keepBrackets = false): Token[] {
  // The keypad shows × ÷ − √ π; normalise them to what the parser reads.
  let text = input.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/√/g, "sqrt").replace(/π/g, "pi").replace(/\s+/g, "");
  if (!keepBrackets) text = text.replace(/[[{]/g, "(").replace(/[\]}]/g, ")");
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    const number = rest.match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/i);
    if (number && !/^e[a-z]/i.test(rest)) {
      tokens.push({ type: "num", value: Number(number[0]) });
      i += number[0].length;
      continue;
    }
    const name = rest.match(/^(asin|acos|atan|sin|cos|tan|sqrt|ln|log|pi|e)/i);
    if (name) {
      tokens.push({ type: "id", value: name[0].toLowerCase() });
      i += name[0].length;
      continue;
    }
    if ("+-*/^()[]{}%!".includes(text[i])) {
      tokens.push({ type: "op", value: text[i] });
      i += 1;
      continue;
    }
    throw new Error(`অচেনা চিহ্ন: ${text[i]}`);
  }
  return tokens;
}

function factorial(n: number) {
  if (n < 0 || !Number.isInteger(n)) throw new Error("! শুধু 0 বা ধনাত্মক পূর্ণসংখ্যায়");
  if (n > 170) return Infinity;
  let result = 1;
  for (let k = 2; k <= n; k++) result *= k;
  return result;
}

/** Evaluates `input`; throws an Error with a short Bangla message when it can't. */
export function evaluate(input: string, mode: AngleMode = "deg"): number {
  checkBrackets(input);
  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (value: string) => peek()?.type === "op" && peek()!.value === value;
  const toRad = (x: number) => (mode === "deg" ? (x * Math.PI) / 180 : x);
  const fromRad = (x: number) => (mode === "deg" ? (x * 180) / Math.PI : x);
  // sin 180° is 1.2e-16 in floating point; snap such dust to 0 for trig results.
  const clean = (x: number) => (Math.abs(x) < 1e-12 ? 0 : x);

  function applyFn(fn: Fn, x: number) {
    switch (fn) {
      case "sin": return clean(Math.sin(toRad(x)));
      case "cos": return clean(Math.cos(toRad(x)));
      case "tan": {
        if (mode === "deg" && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-9) throw new Error("tan 90° সংজ্ঞায়িত নয়");
        return clean(Math.tan(toRad(x)));
      }
      case "asin": case "acos": {
        if (x < -1 || x > 1) throw new Error("মান −1 থেকে 1 এর মধ্যে হতে হবে");
        return fn === "asin" ? fromRad(Math.asin(x)) : fromRad(Math.acos(x));
      }
      case "atan": return fromRad(Math.atan(x));
      case "sqrt": {
        if (x < 0) throw new Error("ঋণাত্মক সংখ্যার বর্গমূল হয় না");
        return Math.sqrt(x);
      }
      case "ln": case "log": {
        if (x <= 0) throw new Error("log শুধু ধনাত্মক সংখ্যায়");
        return fn === "ln" ? Math.log(x) : Math.log10(x);
      }
    }
  }

  // expression := term (('+'|'-') term)*
  function expression(): number {
    let value = term();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { value: string }).value;
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  }

  // term := power (('*'|'/'| implied) power)*
  function term(): number {
    let value = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = (tokens[pos++] as { value: string }).value;
        const right = unary();
        if (op === "/" && right === 0) throw new Error("শূন্য দিয়ে ভাগ করা যায় না");
        value = op === "*" ? value * right : value / right;
        continue;
      }
      // Implied multiplication: a number, name or "(" right after a value.
      const next = peek();
      if (next && (next.type === "num" || next.type === "id" || (next.type === "op" && next.value === "("))) {
        value *= unary();
        continue;
      }
      return value;
    }
  }

  // unary := ('-'|'+') unary | power
  function unary(): number {
    if (isOp("-")) { pos++; return -unary(); }
    if (isOp("+")) { pos++; return unary(); }
    return power();
  }

  // power := postfix ('^' unary)?   (right-associative: 2^3^2 = 2^9)
  function power(): number {
    const base = postfix();
    if (isOp("^")) {
      pos++;
      return base ** unary();
    }
    return base;
  }

  // postfix := primary ('!' | '%')*
  function postfix(): number {
    let value = primary();
    while (isOp("!") || isOp("%")) {
      value = (tokens[pos++] as { value: string }).value === "!" ? factorial(value) : value / 100;
    }
    return value;
  }

  // primary := number | pi | e | fn primary | '(' expression ')'
  function primary(): number {
    const token = tokens[pos];
    if (!token) throw new Error("হিসাব অসম্পূর্ণ");
    if (token.type === "num") { pos++; return token.value; }
    if (token.type === "id") {
      pos++;
      if (token.value === "pi") return Math.PI;
      if (token.value === "e") return Math.E;
      // A function takes the next value: sin(30), sin30, √2, √(2+2).
      return applyFn(token.value as Fn, postfix());
    }
    if (token.value === "(") {
      pos++;
      const value = expression();
      // A missing ")" at the end is forgiven, as on phone calculators.
      if (isOp(")")) pos++;
      else if (pos < tokens.length) throw new Error("বন্ধনী মেলেনি");
      return value;
    }
    throw new Error("হিসাব অসম্পূর্ণ");
  }

  if (!tokens.length) throw new Error("কিছু লেখা নেই");
  const result = expression();
  if (pos < tokens.length) throw new Error("হিসাব বোঝা যায়নি");
  if (Number.isNaN(result)) throw new Error("ফল সংজ্ঞায়িত নয়");
  return result;
}

/** A result for the display: up to 10 significant digits, no float dust (0.1+0.2 → 0.3). */
export function formatResult(value: number): string {
  if (!Number.isFinite(value)) return value > 0 ? "∞" : "−∞";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1e12 || abs < 1e-9) return value.toExponential(6).replace(/\.?0+e/, "e");
  return String(Number(value.toPrecision(10)));
}

/**
 * The result as a fraction (লব/হর) when it is one with a denominator up to 10,000 (0.75 → [3, 4]);
 * null for whole numbers and for values like π that are not fractions.
 */
export function toFraction(value: number): [number, number] | null {
  if (!Number.isFinite(value) || Number.isInteger(value)) return null;
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  // Continued fraction convergents h/k until one matches the value.
  let [h0, h1, k0, k1, rest] = [0, 1, 1, 0, x];
  for (let step = 0; step < 40; step++) {
    const a = Math.floor(rest);
    [h0, h1] = [h1, a * h1 + h0];
    [k0, k1] = [k1, a * k1 + k0];
    if (k1 > 10_000) return null;
    if (Math.abs(h1 / k1 - x) < 1e-12 * Math.max(1, x)) return k1 === 1 ? null : [sign * h1, k1];
    if (rest - a < 1e-12) return null;
    rest = 1 / (rest - a);
  }
  return null;
}

type Node =
  | { kind: "num"; text: string }
  | { kind: "const"; name: "pi" | "e" }
  | { kind: "hole" }
  | { kind: "fn"; name: Fn; arg: Node }
  | { kind: "bin"; op: "+" | "-" | "*" | "/" | "^" | "implied"; left: Node; right: Node }
  | { kind: "neg"; sign: "-" | "+"; value: Node }
  | { kind: "post"; op: "!" | "%"; value: Node }
  | { kind: "group"; open: string; inner: Node; closed: boolean };

const CLOSE: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const LEFT: Record<string, string> = { "(": "(", "[": "[", "{": "\\{" };
const RIGHT: Record<string, string> = { "(": ")", "[": "]", "{": "\\}" };
const FN_LATEX: Record<Fn, string> = { sin: "\\sin", cos: "\\cos", tan: "\\tan", asin: "\\sin^{-1}", acos: "\\cos^{-1}", atan: "\\tan^{-1}", ln: "\\ln", log: "\\log", sqrt: "" };
const HOLE = "\\textcolor{#cbd5e1}{\\square}";

/**
 * The expression drawn like a textbook with KaTeX (the same renderer as Quill's formulas):
 * ÷ as a stacked fraction, powers raised, √ over its contents. Unfinished input shows a light □
 * where the next number goes (8^ → 8^□). Returns null when it can't be read at all.
 */
export function toLatex(input: string): string | null {
  let tokens: Token[];
  try { tokens = tokenize(input, true); } catch { return null; }
  if (!tokens.length) return null;
  let pos = 0;
  const isOp = (value: string) => tokens[pos]?.type === "op" && tokens[pos].value === value;
  const isOpener = () => isOp("(") || isOp("[") || isOp("{");

  function expression(): Node {
    let node = term();
    while (isOp("+") || isOp("-")) {
      const op = tokens[pos++].value as "+" | "-";
      node = { kind: "bin", op, left: node, right: term() };
    }
    return node;
  }
  function term(): Node {
    let node = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = tokens[pos++].value as "*" | "/";
        node = { kind: "bin", op, left: node, right: unary() };
        continue;
      }
      const next = tokens[pos];
      if (next && (next.type === "num" || next.type === "id" || isOpener())) {
        node = { kind: "bin", op: "implied", left: node, right: unary() };
        continue;
      }
      return node;
    }
  }
  function unary(): Node {
    if (isOp("-") || isOp("+")) return { kind: "neg", sign: tokens[pos++].value as "-" | "+", value: unary() };
    const base = postfix();
    if (isOp("^")) { pos++; return { kind: "bin", op: "^", left: base, right: unary() }; }
    return base;
  }
  function postfix(): Node {
    let node = primary();
    while (isOp("!") || isOp("%")) node = { kind: "post", op: tokens[pos++].value as "!" | "%", value: node };
    return node;
  }
  function primary(): Node {
    const token = tokens[pos];
    if (!token) return { kind: "hole" };
    if (token.type === "num") { pos++; return { kind: "num", text: String(token.value) }; }
    if (token.type === "id") {
      pos++;
      if (token.value === "pi" || token.value === "e") return { kind: "const", name: token.value };
      return { kind: "fn", name: token.value as Fn, arg: postfix() };
    }
    if (isOpener()) {
      const open = tokens[pos++].value as string;
      const inner = isOp(CLOSE[open]) ? { kind: "hole" } as const : expression();
      const closed = isOp(CLOSE[open]);
      if (closed) pos++;
      return { kind: "group", open, inner, closed };
    }
    return { kind: "hole" };
  }

  const nodes: Node[] = [];
  // Anything the grammar can't place (a stray ")") ends drawing; the rest shows as plain text.
  while (pos < tokens.length) {
    const before = pos;
    nodes.push(expression());
    if (pos === before) return null;
  }

  // Brackets that only group a fraction part or a power are not drawn (the layout shows it).
  const bare = (node: Node) => (node.kind === "group" && node.closed && node.open === "(" ? node.inner : node);
  function draw(node: Node): string {
    switch (node.kind) {
      case "num": return node.text;
      case "const": return node.name === "pi" ? "\\pi " : "e";
      case "hole": return HOLE;
      case "fn": return node.name === "sqrt" ? `\\sqrt{${draw(bare(node.arg))}}` : `${FN_LATEX[node.name]}${node.arg.kind === "group" ? "" : "\\,"}${draw(node.arg)}`;
      case "neg": return `${node.sign}${draw(node.value)}`;
      case "post": return `${draw(node.value)}${node.op === "%" ? "\\%" : "!"}`;
      case "group": return `\\left${LEFT[node.open]}${draw(node.inner)}\\right${node.closed ? RIGHT[node.open] : "."}`;
      case "bin":
        switch (node.op) {
          case "/": return `\\dfrac{${draw(bare(node.left))}}{${draw(bare(node.right))}}`;
          case "^": return `{${draw(node.left)}}^{${draw(bare(node.right))}}`;
          case "*": return `${draw(node.left)}\\times ${draw(node.right)}`;
          case "implied": return `${draw(node.left)}${node.left.kind === "num" && node.right.kind === "num" ? "\\cdot " : ""}${draw(node.right)}`;
          default: return `${draw(node.left)}${node.op}${draw(node.right)}`;
        }
    }
  }
  return nodes.map(draw).join("");
}
