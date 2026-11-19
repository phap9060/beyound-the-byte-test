// Tokens extraídos do protótipo (docs/prototipo/README.md). Fonte única do tema.

export const colors = {
  paper: "#ffffff",
  desk: "#f6f7f9",
  ink: {
    DEFAULT: "#1b2431",
    2: "#3d4656",
    3: "#5b6472",
  },
  rule: "#e6e8ec",
  cta: "#0062c4",
  thread: "#eef1f5",

  primary: {
    DEFAULT: "#0285f7",
    hover: "#0071d6",
    soft: "#0285f712",
    text: "#0069c7",
  },
  success: {
    DEFAULT: "#00bd6c",
    soft: "#00bd6c14",
    text: "#00804a",
  },
  warning: {
    DEFAULT: "#f5a500",
    soft: "#f5a50018",
    text: "#946300",
  },
  danger: {
    DEFAULT: "#ee343b",
    soft: "#ee343b12",
    text: "#c4161d",
  },
  violet: {
    DEFAULT: "#a37aff",
    soft: "#a37aff16",
    text: "#6b3fe0",
  },
} as const;

// As variáveis CSS são criadas pelo next/font em app/layout.tsx.
export const fonts = {
  sans: ["var(--font-schibsted)", "ui-sans-serif", "system-ui", "sans-serif"],
  display: ["var(--font-newsreader)", "ui-serif", "Georgia", "serif"],
} as const;

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "14px",
} as const;

export type ColorToken = keyof typeof colors;
