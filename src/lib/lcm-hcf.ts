/**
 * লসাগু / গসাগু by short division, written the way the school book does it, so a student can check
 * their own working step by step.
 *
 * - লসাগু: divide by the smallest prime that divides **at least two** of the numbers; the numbers it
 *   doesn't divide come down unchanged. Stop when no prime divides two of them. লসাগু = every divisor
 *   × what is left in the last row.
 * - গসাগু: divide only by a prime that divides **all** the numbers. গসাগু = the divisors multiplied
 *   (1 when they share none).
 */

export type LadderStep = { divisor: number; row: number[] };
export type Ladder = {
  /** Each row with the prime it was divided by (the last row has none). */
  steps: LadderStep[];
  last: number[];
  /** The numbers multiplied for the answer, in book order. */
  factors: number[];
  result: number;
};

/** The largest number accepted, so products stay exact in JavaScript numbers. */
export const LCM_MAX_INPUT = 1_000_000;
export const LCM_MAX_COUNT = 10;

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** "১২, 18 ২৪" → [12, 18, 24] (one number is fine: then its factors are shown): commas, spaces, Bangla or English digits. Throws a Bangla message. */
export function parseNumbers(input: string): number[] {
  const text = input.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
  const parts = text.split(/[\s,،;।|]+/).filter(Boolean);
  if (parts.length === 0) throw new Error("একটা সংখ্যা দাও (উৎপাদক), বা একাধিক (লসাগু/গসাগু)।");
  if (parts.length > LCM_MAX_COUNT) throw new Error(`একবারে ${LCM_MAX_COUNT}টার বেশি সংখ্যা নয়।`);
  return parts.map((part) => {
    if (!/^\d+$/.test(part)) throw new Error(`“${part}” পূর্ণ সংখ্যা নয়। শুধু ধনাত্মক পূর্ণ সংখ্যা দাও।`);
    const value = Number(part);
    if (value < 1) throw new Error("০ দিয়ে লসাগু/গসাগু হয় না। ১ বা তার বেশি দাও।");
    if (value > LCM_MAX_INPUT) throw new Error("প্রতিটা সংখ্যা ১০,০০,০০০-এর মধ্যে রাখো।");
    return value;
  });
}

/** Prime factors of n, each once (trial division: n ≤ 10 lakh, so at most ~1000 tries). */
function primeFactors(n: number) {
  const primes: number[] = [];
  for (let d = 2; d * d <= n; d++) {
    if (n % d === 0) primes.push(d);
    while (n % d === 0) n /= d;
  }
  if (n > 1) primes.push(n);
  return primes;
}

/** Smallest prime that divides at least `need` of the numbers, or null. Only their own prime factors can. */
function primeDividing(numbers: number[], need: number) {
  const candidates = [...new Set(numbers.flatMap(primeFactors))].sort((a, b) => a - b);
  return candidates.find((p) => numbers.filter((n) => n % p === 0).length >= need) ?? null;
}

function ladder(numbers: number[], need: number): Omit<Ladder, "factors" | "result"> {
  const steps: LadderStep[] = [];
  let row = numbers;
  for (let p = primeDividing(row, need); p !== null; p = primeDividing(row, need)) {
    steps.push({ divisor: p, row });
    row = row.map((n) => (n % p === 0 ? n / p : n));
  }
  return { steps, last: row };
}

/** লসাগু ladder: the divisors, then the numbers left over (1s are left out of the product). */
export function lcmLadder(numbers: number[]): Ladder {
  const { steps, last } = ladder(numbers, 2);
  const factors = [...steps.map((step) => step.divisor), ...last.filter((n) => n !== 1)];
  return { steps, last, factors, result: factors.reduce((a, b) => a * b, 1) };
}

/** গসাগু ladder: only primes common to every number. */
export function hcfLadder(numbers: number[]): Ladder {
  const { steps, last } = ladder(numbers, numbers.length);
  const factors = steps.map((step) => step.divisor);
  return { steps, last, factors, result: factors.reduce((a, b) => a * b, 1) };
}

/**
 * One number broken into prime factors the book's way: divide by the smallest prime while the
 * quotient is not itself prime; that last prime is the bottom row. 36 → 2, 2, 3 | 3.
 */
export function primeFactorLadder(n: number): Ladder {
  const steps: LadderStep[] = [];
  let rest = n;
  while (rest > 1 && primeFactors(rest)[0] !== rest) {
    const p = primeFactors(rest)[0];
    steps.push({ divisor: p, row: [rest] });
    rest /= p;
  }
  const factors = rest > 1 ? [...steps.map((step) => step.divisor), rest] : [];
  return { steps, last: [rest], factors, result: n };
}

/** The same primes grouped with their powers, in order: [2, 2, 3, 3] → [[2, 2], [3, 2]]. */
export function powersOf(factors: number[]): Array<[prime: number, power: number]> {
  const counts = new Map<number, number>();
  for (const p of factors) counts.set(p, (counts.get(p) ?? 0) + 1);
  return [...counts].sort((a, b) => a[0] - b[0]);
}

/** Every factor (গুণনীয়ক) of n, smallest first. */
export function allFactors(n: number) {
  const small: number[] = [];
  const large: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d !== 0) continue;
    small.push(d);
    if (d * d !== n) large.unshift(n / d);
  }
  return [...small, ...large];
}
