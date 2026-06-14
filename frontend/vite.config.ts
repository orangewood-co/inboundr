import path from "path"
import { TanStackRouterVite } from "@tanstack/router-plugin/vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, type PluginOption } from "vite"
import { analyzer } from "vite-bundle-analyzer"

function appVersionPlugin(): PluginOption {
  return {
    name: "app-version",
    generateBundle() {
      const version =
        process.env.VITE_APP_VERSION ??
        process.env.GIT_COMMIT_SHA ??
        new Date().toISOString()

      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: `${JSON.stringify({ version })}\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  build: {
    outDir: "dist",
    minify: true,
    cssMinify: true,
  },
  plugins: [
    TanStackRouterVite({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
    appVersionPlugin(),
    ...(process.env.ANALYZE === "true"
      ? [
          analyzer({
            analyzerMode: "static",
            openAnalyzer: true,
          }) as PluginOption,
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
