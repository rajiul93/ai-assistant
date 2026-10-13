/**
 * Study streak: how many days in a row the user studied, ending today — or yesterday, since today
 * isn't over yet and a streak shouldn't read 0 at breakfast. `days` are local dates ("YYYY-MM-DD")
 * with any study session, in any order; `today` is the local date now.
 */
export function studyStreak(days: string[], today: string) {
  const studied = new Set(days);
  const step = (date: string) => {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  };
  let cursor = studied.has(today) ? today : step(today);
  let count = 0;
  while (studied.has(cursor)) { count++; cursor = step(cursor); }
  return count;
}
