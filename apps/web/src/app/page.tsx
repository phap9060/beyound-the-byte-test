export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-desk p-4">
      <div className="w-full max-w-sm rounded-lg border border-rule bg-paper p-6">
        <p className="text-[12.5px] text-ink-3">Service desk de TI da Nexo</p>
        <h1 className="mt-1 font-display text-[34px] leading-tight">Nexo Assist</h1>
        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px]">
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-success-text">
            Assistente online
          </span>
          <span className="rounded-full bg-warning-soft px-2.5 py-1 text-warning-text">
            Aguardando atendente
          </span>
          <span className="rounded-full bg-danger-soft px-2.5 py-1 text-danger-text">
            prazo vencido
          </span>
          <span className="rounded-full bg-violet-soft px-2.5 py-1 text-violet-text">IA</span>
        </div>
      </div>
    </main>
  );
}
