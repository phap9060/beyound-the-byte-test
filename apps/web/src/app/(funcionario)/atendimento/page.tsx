import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/server/session";

export default async function Page() {
  const user = await requireUser("funcionario");
  return (
    <main className="flex min-h-dvh flex-col items-start gap-4 p-6">
      <h1 className="font-display text-[34px]">Atendimento</h1>
      <p className="text-ink-3">
        {user.name} · {user.email} · {user.department}
      </p>
      <LogoutButton className="flex items-center gap-2 rounded-lg border border-rule px-3 py-2 text-[13.5px]" />
    </main>
  );
}
