type SpeechEvent = { type?: string; audio?: string; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } };
type Usage = { input: number; output: number; total: number };

/**
 * OpenAI's speech events → a plain MP3 byte stream, passed on piece by piece. `onDone` gets the
 * token usage from the final event (undefined if the stream broke off).
 */
export function audioFromEvents(events: ReadableStream<Uint8Array>, onDone: (usage: Usage | undefined) => void) {
  const reader = events.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let usage: Usage | undefined;
  let sentAny = false;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      for (;;) {
        const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true as const }));
        if (done) {
          onDone(usage);
          if (!sentAny) controller.error(new Error("no audio"));
          else controller.close();
          return;
        }
        pending += decoder.decode(value, { stream: true });
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        let wrote = false;
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          const event = JSON.parse(data) as SpeechEvent;
          if (event.type === "speech.audio.delta" && event.audio) {
            controller.enqueue(new Uint8Array(Buffer.from(event.audio, "base64")));
            sentAny = wrote = true;
          }
          if (event.type === "speech.audio.done" && event.usage) {
            const input = event.usage.input_tokens ?? 0;
            const output = event.usage.output_tokens ?? 0;
            usage = { input, output, total: event.usage.total_tokens ?? input + output };
          }
        }
        if (wrote) return;
      }
    },
    cancel() { void reader.cancel(); },
  });
}
