import { onConsole } from "@/server/events";
import { getCurrentUser } from "@/server/session";
import { sseResponse } from "@/server/sse";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (user?.role !== "analista") return new Response(null, { status: 403 });

  return sseResponse(request.signal, (writer) =>
    onConsole((conversationId) => {
      writer.send({ conversationId }, { event: "changed" });
    }),
  );
}
