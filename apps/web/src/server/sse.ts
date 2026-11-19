import "server-only";

const HEARTBEAT_MS = 20_000;

export interface SseWriter {
  send: (data: unknown, options?: { event?: string; id?: number }) => void;
}

// Monta uma resposta SSE. `start` registra os ouvintes e devolve a função que os remove.
export function sseResponse(signal: AbortSignal, start: (writer: SseWriter) => () => void) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const write = (chunk: string) => {
        if (open) controller.enqueue(encoder.encode(chunk));
      };

      const stop = start({
        send(data, options = {}) {
          const lines = [
            options.id === undefined ? "" : `id: ${String(options.id)}\n`,
            options.event ? `event: ${options.event}\n` : "",
            `data: ${JSON.stringify(data)}\n\n`,
          ];
          write(lines.join(""));
        },
      });

      // Comentário periódico: proxies costumam derrubar conexões sem tráfego.
      const heartbeat = setInterval(() => {
        write(": ping\n\n");
      }, HEARTBEAT_MS);

      write("retry: 2000\n\n");

      signal.addEventListener("abort", () => {
        open = false;
        clearInterval(heartbeat);
        stop();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
