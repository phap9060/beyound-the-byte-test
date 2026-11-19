"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Quando qualquer conversa muda, recarrega os dados da página (lista e conversa aberta).
export function LiveRefresh() {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/console/events");
    let timer: ReturnType<typeof setTimeout> | undefined;
    source.addEventListener("changed", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
      }, 250);
    });
    return () => {
      clearTimeout(timer);
      source.close();
    };
  }, [router]);

  return null;
}
