import { LogOut } from "lucide-react";

import { logout } from "@/app/login/actions";
import { requireUser } from "@/server/session";

export default async function ConsolePage() {
  const user = await requireUser("analista");
  return (
    <main className="flex min-h-dvh flex-col items-start gap-4 p-6">
      <h1 className="font-display text-[34px]">Conversas</h1>
      <p className="text-ink-3">
        {user.name} · {user.supportTeam}
      </p>
      <form action={logout}>
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg border border-rule px-3 py-2 text-[13.5px]"
        >
          <LogOut className="size-4" aria-hidden />
          Sair
        </button>
      </form>
    </main>
  );
}
