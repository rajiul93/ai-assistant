import { create } from "zustand";
import { persist } from "zustand/middleware";

type TypingKeyboardStore = {
  /** The user's own choice; null = decide automatically. */
  choice: boolean | null;
  /** A real key press arrived on a touch device, i.e. a keyboard is plugged in (OTG / Bluetooth). */
  detected: boolean;
  setChoice: (on: boolean) => void;
  /** Called on every keydown in the typing boxes; marks a hardware keyboard on phones. */
  noteKey: (event: KeyboardEvent) => void;
};

/**
 * Phones with a keyboard plugged in (OTG or Bluetooth). When on, the typing boxes ask for no
 * on-screen keyboard (inputMode="none"), so the whole screen stays free for the lesson.
 */
export const useTypingKeyboard = create<TypingKeyboardStore>()(persist((set, get) => ({
  choice: null,
  detected: false,
  setChoice: (on) => set({ choice: on }),
  noteKey: (event) => {
    if (get().detected || typeof window === "undefined") return;
    // On-screen keyboards report "Unidentified" / keyCode 229; a plugged-in keyboard sends the real key.
    const real = event.key.length === 1 && event.keyCode !== 229 && !event.isComposing;
    if (real && window.matchMedia("(pointer: coarse)").matches) set({ detected: true });
  },
}), {
  name: "prep:typing-keyboard",
  partialize: (state) => ({ choice: state.choice, detected: state.detected }),
  // Read after mount (TypingWorkspace), so the server HTML and the first client render agree.
  skipHydration: true,
}));

/** Whether the hardware-keyboard mode is on (the user's choice, else what was detected). */
export const useHardwareKeyboard = () => useTypingKeyboard((state) => state.choice ?? state.detected);
