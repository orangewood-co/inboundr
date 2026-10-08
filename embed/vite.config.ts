import { readFile } from "node:fs/promises"
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv, transformWithEsbuild, type Plugin } from "vite"

const SUPPORT_WIDGET_SOURCE = path.resolve(__dirname, "src/widget/support-widget.ts")

/**
 * Compiles the chat launcher into a standalone classic script at a stable,
 * unhashed URL so customer sites can embed it with a single script tag.
 */
function supportWidget(apiOrigin: string): Plugin {
  async function compile(minify: boolean) {
    const source = await readFile(SUPPORT_WIDGET_SOURCE, "utf8")
    const result = await transformWithEsbuild(source, SUPPORT_WIDGET_SOURCE, {
      format: "iife",
      target: "es2018",
      minify,
      define: { __INBOUNDR_API_ORIGIN__: JSON.stringify(apiOrigin) },
    })
    return result.code
  }

  return {
    name: "inboundr-support-widget",
    configureServer(server) {
      server.middlewares.use("/support-widget.js", (_req, res, next) => {
        compile(false).then((code) => {
          res.setHeader("Content-Type", "text/javascript; charset=utf-8")
          res.setHeader("Cache-Control", "no-store")
          res.end(code)
        }, next)
      })
    },
    async generateBundle() {
      this.emitFile({ type: "asset", fileName: "support-widget.js", source: await compile(true) })
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const apiOrigin = loadEnv(mode, __dirname, "VITE_").VITE_API_URL?.trim()
  if (command === "build" && !apiOrigin) {
    throw new Error("VITE_API_URL must be set for production builds")
  }

  return {
    plugins: [react(), tailwindcss(), supportWidget(apiOrigin || "http://localhost:3000")],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
