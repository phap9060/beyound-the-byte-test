"use client";

import type { QuickOption } from "@nexo/domain";
import { useEffect } from "react";

interface QuickOptionsProps {
  question?: string | undefined;
  options: QuickOption[];
  numbered: boolean;
  selected?: string | undefined;
  onSelect?: ((option: QuickOption) => void) | undefined;
}

function typingInField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement && target.closest("input, textarea, [contenteditable]") !== null
  );
}

export function QuickOptions({
  question,
  options,
  numbered,
  selected,
  onSelect,
}: QuickOptionsProps) {
  const active = selected === undefined && onSelect !== undefined;

  useEffect(() => {
    if (!active || !numbered) return;
    function onKey(e: KeyboardEvent) {
      if (typingInField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const option = options[Number(e.key) - 1];
      if (option) onSelect?.(option);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [active, numbered, options, onSelect]);

  return (
    <div className="flex flex-col gap-3">
      {question && <p className="font-semibold">{question}</p>}
      <div role="group" aria-label={question ?? "Opções"} className="flex flex-wrap gap-1.5">
        {options.map((option, i) => {
          const isSelected = option.value === selected;
          return (
            <button
              key={option.value}
              type="button"
              disabled={!active}
              aria-pressed={isSelected}
              onClick={() => onSelect?.(option)}
              className={`flex min-h-9 items-center gap-[7px] rounded-lg border px-3 py-[7px] text-[13.5px] font-medium transition-colors max-sm:min-h-11 ${
                isSelected
                  ? "border-primary bg-primary-soft text-primary-text"
                  : "border-rule bg-paper text-ink enabled:hover:border-ink/20 enabled:hover:bg-desk disabled:opacity-50"
              }`}
            >
              {numbered && (
                <kbd
                  className={`flex size-4 items-center justify-center rounded-sm font-sans text-[11.5px] max-lg:hidden ${
                    isSelected ? "bg-primary text-white" : "bg-desk text-ink-3"
                  }`}
                >
                  {i + 1}
                </kbd>
              )}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
