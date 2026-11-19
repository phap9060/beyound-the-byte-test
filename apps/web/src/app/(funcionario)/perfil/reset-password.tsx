"use client";

import { CircleCheckBig, Mail, RotateCcwKey } from "lucide-react";
import { useState } from "react";

// Simulado: o protótipo não tem serviço de e-mail; a confirmação só mostra o que aconteceria.
export function ResetPassword({ email }: { email: string }) {
  const [sent, setSent] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSent(true);
        }}
        disabled={sent}
        className="flex h-9 shrink-0 items-center gap-[7px] rounded-lg border border-ink/12 pr-3.5 pl-3 text-[13.5px] font-medium text-ink-2 hover:bg-desk disabled:opacity-60"
      >
        <RotateCcwKey className="size-[15px]" aria-hidden />
        Redefinir senha
      </button>
      <p
        role="status"
        className="col-span-full -mx-6 -mb-6 flex items-center gap-2 border-t border-rule bg-desk px-6 py-3 text-[13px] text-ink-3"
      >
        {sent ? (
          <>
            <CircleCheckBig className="size-3.5 shrink-0 text-success-text" aria-hidden />
            Enviamos um link de redefinição para {email}.
          </>
        ) : (
          <>
            <Mail className="size-3.5 shrink-0" aria-hidden />
            Enviaremos um link de redefinição para {email}
          </>
        )}
      </p>
    </>
  );
}
