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
      {/* Keys are a tenth of the width (minus gaps), capped at 40px, so the guide fits a phone. */}
      <div className="max-w-[27rem] space-y-1">
        {keyboardRows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1" style={{ paddingLeft: `${rowIndex * 3.5}%` }}>
            {row.map((key) => {
              const lower = key.label.toLowerCase();
              return (
                <span key={key.code} className={`relative grid aspect-square w-[calc((100%-2.25rem)/10)] max-w-10 shrink-0 place-items-center rounded-md border text-xs ${active.has(key.label) ? "border-emerald-700 bg-emerald-600 text-white" : key.code === "KeyF" || key.code === "KeyJ" ? "border-zinc-400 bg-white" : "border-zinc-200 bg-white"}`}>
                  <span className="absolute left-0.5 top-0 text-[8.5px] opacity-70 sm:left-1 sm:top-0.5 sm:text-[10px]">{key.label}</span>
                  {showBangla && <span className="mt-1.5 text-[11px] sm:mt-2 sm:text-sm">{bijoyKeyMap[lower]}</span>}
                </span>
              );
            })}
          </div>
        ))}
        <div className="flex gap-1">
          <span className={`grid h-8 w-1/4 place-items-center rounded-md border text-xs sm:h-9 ${shift ? "border-emerald-700 bg-emerald-600 text-white" : "border-zinc-200 bg-white"}`}>Shift</span>
          <span className="grid h-8 flex-1 place-items-center rounded-md border border-zinc-200 bg-white text-xs text-zinc-400 sm:h-9">Space</span>
        </div>
      </div>
      {fingers.length > 0 && <p className="mt-3 text-sm text-zinc-600">{fingers.map((finger) => fingerNames[finger]).join(" → ")}{shift && " · Shift with the other hand's little finger"}</p>}
    </div>
  );
}
