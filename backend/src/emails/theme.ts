export const barebonesBoxedTailwindConfig = {
  theme: {
    screens: {
      mobile: { max: "640px" },
    },
    extend: {
      colors: {
        bg: "#ffffff",
        "bg-2": "#f5f5f3",
        fg: "#171717",
        "fg-2": "#454541",
        "fg-3": "#777771",
        "fg-inverted": "#ffffff",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      fontSize: {
        11: ["11px", { lineHeight: "16px" }],
        13: ["13px", { lineHeight: "20px" }],
        16: ["16px", { lineHeight: "24px" }],
        28: ["28px", { lineHeight: "34px", fontWeight: "600" }],
      },
    },
  },
};
