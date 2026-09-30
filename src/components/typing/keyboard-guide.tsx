import { bijoyKeyMap, physicalKey } from "@/lib/typing/bijoy";
import { fingerFor, fingerNames, keyboardRows } from "@/lib/typing/layouts";

// keys: keystrokes as characters (e.g. ["g", "f"] or ["J"]); showBangla labels keys with their Bijoy letter.
export function KeyboardGuide({ keys, showBangla }: { keys: string[]; showBangla: boolean }) {
  const physical = keys.map(physicalKey);
  const active = new Set(physical.map((key) => key.label));
  const shift = physical.some((key) => key.shift);
  const fingers = [...new Set(physical.map((key) => fingerFor(key.label)).filter((finger) => finger !== undefined))];

  return (
    <div>
      <div className="space-y-1">
        {keyboardRows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1" style={{ paddingLeft: `${rowIndex * 1.1}rem` }}>
            {row.map((key) => {
              const lower = key.label.toLowerCase();
              return (
                <span key={key.code} className={`relative grid size-9 place-items-center rounded border text-xs sm:size-10 ${active.has(key.label) ? "border-emerald-700 bg-emerald-600 text-white" : key.code === "KeyF" || key.code === "KeyJ" ? "border-zinc-400 bg-white" : "border-zinc-200 bg-white"}`}>
                  <span className="absolute left-1 top-0.5 text-[10px] opacity-70">{key.label}</span>
                  {showBangla && <span className="mt-2 text-sm">{bijoyKeyMap[lower]}</span>}
                </span>
              );
            })}
          </div>
        ))}
        <div className="flex gap-1">
          <span className={`grid h-9 w-24 place-items-center rounded border text-xs ${shift ? "border-emerald-700 bg-emerald-600 text-white" : "border-zinc-200 bg-white"}`}>Shift</span>
          <span className="grid h-9 flex-1 place-items-center rounded border border-zinc-200 bg-white text-xs text-zinc-400">Space</span>
        </div>
      </div>
      {fingers.length > 0 && <p className="mt-3 text-sm text-zinc-600">{fingers.map((finger) => fingerNames[finger]).join(" → ")}{shift && " · Shift with the other hand's little finger"}</p>}
    </div>
  );
}
