import { LogOut } from "lucide-react";

import { logout } from "@/app/login/actions";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={className}>
        <LogOut className="size-4" aria-hidden />
        Sair
      </button>
    </form>
  );
}
