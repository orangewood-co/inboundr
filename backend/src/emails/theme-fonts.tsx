import { Font } from "react-email";

export function BarebonesFonts() {
  return (
    <Font
      fontFamily="Inter"
      fallbackFontFamily="Arial"
      webFont={{
        url: "https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTcviYwY.woff2",
        format: "woff2",
      }}
      fontWeight={400}
      fontStyle="normal"
    />
  );
}
