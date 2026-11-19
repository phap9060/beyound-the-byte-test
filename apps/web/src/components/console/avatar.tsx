import { initials } from "@nexo/domain";

// Cores de avatar do protótipo; a escolha é estável por nome.
const PALETTE = [
  "bg-[#DCE9F7] text-[#0062C4]",
  "bg-[#E6E1F7] text-[#5B3FC4]",
  "bg-[#DDF1E6] text-[#00804A]",
  "bg-[#F9E9D3] text-[#946300]",
  "bg-[#F7DFE0] text-[#C4161D]",
];

function paletteFor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? "";
}

export function Avatar({ name, size }: { name: string; size: "md" | "lg" }) {
  const dims = size === "lg" ? "size-[46px] text-[15.5px]" : "size-10 text-[14.5px]";
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${dims} ${paletteFor(name)}`}
    >
      {initials(name)}
    </span>
  );
}
