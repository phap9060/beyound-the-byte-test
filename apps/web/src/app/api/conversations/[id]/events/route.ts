import type { ConversationEvent } from "@/lib/chat-types";
import { getConversationRow, messagesAfter, toState } from "@/server/conversations";
import { onConversation } from "@/server/events";
import { getCurrentUser } from "@/server/session";
import { sseResponse } from "@/server/sse";

export const dynamic = "force-dynamic";

function cursor(request: Request): number {
  const raw =
    request.headers.get("last-event-id") ?? new URL(request.url).searchParams.get("after") ?? "0";
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });

  const { id } = await params;
  const conversation = await getConversationRow(id);
  if (!conversation || (user.role === "funcionario" && conversation.employeeId !== user.id)) {
    return new Response(null, { status: 404 });
  }

  let lastSent = cursor(request);

  return sseResponse(request.signal, (writer) => {
    let replaying = true;
    const buffered: ConversationEvent[] = [];

    const emit = (event: ConversationEvent) => {
      if (event.type === "state") {
        writer.send(event, { event: "state" });
        return;
      }
      if (event.message.id <= lastSent) return;
      lastSent = event.message.id;
      writer.send(event, { event: "message", id: event.message.id });
    };

    const stop = onConversation(id, (event) => {
      if (replaying) buffered.push(event);
      else emit(event);
    });

    void (async () => {
      try {
        for (const message of await messagesAfter(id, lastSent)) emit({ type: "message", message });
        const current = await getConversationRow(id);
        if (current) emit({ type: "state", state: toState(current) });
      } finally {
        replaying = false;
        for (const event of buffered.splice(0)) emit(event);
      }
    })();

    return stop;
  });
}
