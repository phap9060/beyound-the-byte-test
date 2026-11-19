import type { Config } from "tailwindcss";

import { colors, fonts, radius } from "./src/theme/tokens";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: [...fonts.sans],
        display: [...fonts.display],
      },
      borderRadius: radius,
    },
  },
} satisfies Config;
