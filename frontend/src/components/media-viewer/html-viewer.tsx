import { useEffect, useState, useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneLight, oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Download, ExternalLink, Code, Eye, Search, FileText } from "lucide-react"
import { ToolbarButton, ToolbarLink, ViewerSpinner, ViewerErrorState, downloadFile } from "./viewer-toolbar"
import { useTheme } from "../theme-provider"

const EXT_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  json5: "json",
  py: "python",
  rb: "ruby",
  php: "php",
  go: "go",
  rs: "rust",
  java: "java",
  kt: "kotlin",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  css: "css",
  scss: "scss",
  less: "less",
  html: "markup",
  htm: "markup",
  xhtml: "markup",
  xml: "markup",
  svg: "markup",
  svelte: "markup",
  vue: "markup",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  sql: "sql",
  graphql: "graphql",
  dockerfile: "docker",
  ini: "ini",
  log: "log",
}

interface HtmlViewerProps {
  url: string
  name: string
}

export default function HtmlViewer({ url, name }: HtmlViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [content, setContent] = useState("")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [viewMode, setViewMode] = useState<"preview" | "source">("preview")
  const [searchQuery, setSearchQuery] = useState("")
  const { theme } = useTheme()
  const resolvedMode =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme


  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const isHtml = ext === "html" || ext === "htm" || ext === "xhtml" || content.trim().toLowerCase().startsWith("<!doctype html") || content.trim().toLowerCase().startsWith("<html")
  const isMarkdown = ext === "md" || ext === "mdx"
  const language = EXT_LANGUAGE[ext] || (isHtml ? "markup" : undefined)

  const [prevUrl, setPrevUrl] = useState(url)
  const [prevReloadKey, setPrevReloadKey] = useState(reloadKey)
  if (url !== prevUrl || reloadKey !== prevReloadKey) {
    setPrevUrl(url)
    setPrevReloadKey(reloadKey)
    setStatus("loading")
    setErrorMessage(null)
    setSearchQuery("")
  }

  useEffect(() => {
    let cancelled = false

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch file (${res.status})`)
        return res.text()
      })
      .then((text) => {
        if (cancelled) return
        setContent(text)
        setStatus("ready")
        if (ext === "html" || ext === "htm" || ext === "xhtml" || ext === "md" || ext === "mdx") {
          setViewMode("preview")
        } else {
          setViewMode("source")
        }
      })
      .catch((err) => {
        if (cancelled) return
        setErrorMessage(err instanceof Error ? err.message : "Unknown error")
        setStatus("error")
      })

    return () => {
      cancelled = true
    }
  }, [url, reloadKey, ext])

  const filteredLines = useMemo(() => {
    if (!searchQuery) return null
    const lines = content.split("\n")
    return lines
      .map((line, index) => ({ line, num: index + 1 }))
      .filter(({ line }) => line.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [content, searchQuery])

  return (
    <div className="flex h-[70svh] flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center justify-between gap-2 border-b bg-background px-3 py-1.5">
        <div className="flex items-center gap-1.5">
          {isHtml && (
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === "preview"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                  }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview HTML
              </button>
              <button
                type="button"
                onClick={() => setViewMode("source")}
                className={`inline-flex items-center gap-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors ${viewMode === "source"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                  }`}
              >
                <Code className="h-3.5 w-3.5" />
                Source Code
              </button>
            </div>
          )}

          {status === "ready" && !isHtml && !isMarkdown && (
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Find in file..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 w-48 rounded-md border bg-background pl-8 pr-2.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <ToolbarButton onClick={() => downloadFile(url, name)} label="Download">
            <Download className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarLink href={url} label="Open in new tab">
            <ExternalLink className="h-4 w-4" />
          </ToolbarLink>
        </div>
      </div>

      {/* Viewer Content */}
      <div className="relative flex-1 overflow-auto bg-background">
        {status === "loading" && <ViewerSpinner />}
        {status === "error" && <ViewerErrorState message={errorMessage} onRetry={() => setReloadKey((k) => k + 1)} />}

        {status === "ready" && (
          <>
            {/* HTML Render Preview inside isolated safe iframe */}
            {isHtml && viewMode === "preview" && (
              <iframe
                title={name}
                srcDoc={content}
                sandbox="allow-same-origin"
                className="h-full w-full border-0 bg-white"
              />
            )}

            {/* Markdown rendered beautifully */}
            {isMarkdown && viewMode === "preview" && (
              <div className="max-w-none px-6 py-4 text-sm leading-relaxed text-foreground [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            )}

            {/* Syntax Highlighted Source Code */}
            {viewMode === "source" && !searchQuery && language && (
              <SyntaxHighlighter
                language={language}
                style={resolvedMode === "dark" ? oneDark : oneLight}
                showLineNumbers
                customStyle={{ margin: 0, minHeight: "100%", fontSize: "0.8125rem", background: "transparent" }}
              >
                {content}
              </SyntaxHighlighter>
            )}

            {/* Search results inside text/code view */}
            {viewMode === "source" && searchQuery && filteredLines && (
              <div className="flex flex-col font-mono text-xs text-foreground bg-background divide-y divide-border select-text">
                <div className="bg-muted/40 px-4 py-2 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1.5">
                  <Search className="h-3 w-3" />
                  Found {filteredLines.length} match(es) for &quot;{searchQuery}&quot;
                </div>
                {filteredLines.length > 0 ? (
                  filteredLines.map(({ line, num }) => (
                    <div key={num} className="flex hover:bg-muted/20 transition-colors">
                      <span className="w-12 shrink-0 select-none border-r px-2 py-1 text-right text-[10px] text-muted-foreground/60 bg-muted/10">
                        {num}
                      </span>
                      <pre className="px-3 py-1 whitespace-pre-wrap break-all flex-1 font-mono text-sm leading-relaxed">
                        {line}
                      </pre>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-1.5">
                    <FileText className="h-6 w-6 text-muted-foreground/50" />
                    No lines found containing &quot;{searchQuery}&quot;
                  </div>
                )}
              </div>
            )}

            {/* Plain text representation */}
            {((viewMode === "source" && !language) || (isMarkdown && viewMode === "source")) && !searchQuery && (
              <pre className="whitespace-pre-wrap break-words px-6 py-4 font-mono text-sm text-foreground select-text leading-relaxed bg-background">
                {content}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
