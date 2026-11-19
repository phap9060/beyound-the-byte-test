"use client";

import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useActionState, useState } from "react";

import { login } from "./actions";
import type { LoginState } from "./actions";

const fieldClass =
  "flex h-11 items-center gap-2.5 rounded-lg border border-ink/12 bg-paper pr-2 pl-3.5 transition-colors focus-within:border-cta focus-within:ring-3 focus-within:ring-cta/15";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);
  const [showHint, setShowHint] = useState(false);

  return (
    <form action={action} className="flex w-full max-w-[380px] flex-col gap-7" noValidate>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[40px] leading-[1.1] tracking-[-0.8px]">Entrar</h1>
        <p className="text-[15.5px] leading-normal text-ink-3">
          Use seu e-mail corporativo e a senha da rede Nexo.
        </p>
      </div>

      <div className="flex flex-col gap-[18px]">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[13.5px] font-medium">
            E-mail corporativo
          </label>
          <div className={fieldClass}>
            <Mail className="size-4 shrink-0 text-ink-3" aria-hidden />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              defaultValue={state.email}
              placeholder="nome.sobrenome@nexo.com.br"
              aria-invalid={state.error ? true : undefined}
              aria-describedby={state.error ? "login-error" : undefined}
              className="w-full bg-transparent text-[14.5px] outline-none placeholder:text-ink-3/60"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-[13.5px] font-medium">
              Senha
            </label>
            <button
              type="button"
              onClick={() => {
                setShowHint((v) => !v);
              }}
              aria-expanded={showHint}
              aria-controls="password-hint"
              className="text-[13.5px] font-medium text-primary-text hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className={fieldClass}>
            <LockKeyhole className="size-4 shrink-0 text-ink-3" aria-hidden />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="w-full bg-transparent text-[14.5px] outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setShowPassword((v) => !v);
              }}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              className="flex size-[30px] shrink-0 items-center justify-center rounded-sm text-ink-3 hover:bg-desk"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {showHint && (
            <p id="password-hint" className="text-[12.5px] leading-normal text-ink-3">
              Redefina em <span className="font-medium text-ink-2">senha.nexo.com.br</span> ou ligue
              no ramal 4000.
            </p>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-[9px] pt-0.5 text-[13.5px] text-ink-2">
          <input type="checkbox" name="remember" defaultChecked className="peer sr-only" />
          <span className="flex size-[18px] items-center justify-center rounded-sm border border-ink/20 text-transparent transition-colors peer-checked:border-cta peer-checked:bg-cta peer-checked:text-white peer-focus-visible:ring-3 peer-focus-visible:ring-cta/25">
            <Check className="size-3" strokeWidth={3} aria-hidden />
          </span>
          Manter conectado neste computador
        </label>
      </div>

      <div className="flex flex-col gap-3">
        {state.error && (
          <p
            id="login-error"
            role="alert"
            className="rounded-lg bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger-text"
          >
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-cta text-[15.5px] font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? "Entrando…" : "Entrar"}
          {!pending && <ArrowRight className="size-4" aria-hidden />}
        </button>
      </div>
    </form>
  );
}
