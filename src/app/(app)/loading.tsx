/** Shown instantly while any page's data loads, so a tap always gets a response. */
export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-lg bg-zinc-200" />
        <div className="h-4 w-72 max-w-full rounded bg-zinc-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-24 rounded-xl bg-zinc-100" />)}
      </div>
      <div className="h-48 rounded-2xl bg-zinc-100" />
      <div className="space-y-3">
        {[0, 1, 2].map((key) => <div key={key} className="h-16 rounded-xl bg-zinc-100" />)}
      </div>
    </div>
  );
}
