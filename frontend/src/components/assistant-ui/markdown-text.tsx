import { memo } from "react"
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown"
import remarkGfm from "remark-gfm"

const components = {
  h1: ({ className, ...props }: React.ComponentProps<"h1">) => (
    <h1
      className={`mt-5 mb-3 text-2xl font-semibold first:mt-0 ${className ?? ""}`}
      {...props}
    />
  ),
  h2: ({ className, ...props }: React.ComponentProps<"h2">) => (
    <h2
      className={`mt-5 mb-2.5 text-xl font-semibold first:mt-0 ${className ?? ""}`}
      {...props}
    />
  ),
  h3: ({ className, ...props }: React.ComponentProps<"h3">) => (
    <h3
      className={`mt-4 mb-2 text-lg font-semibold first:mt-0 ${className ?? ""}`}
      {...props}
    />
  ),
  h4: ({ className, ...props }: React.ComponentProps<"h4">) => (
    <h4
      className={`mt-4 mb-2 text-base font-semibold first:mt-0 ${className ?? ""}`}
      {...props}
    />
  ),
  p: ({ className, ...props }: React.ComponentProps<"p">) => (
    <p
      className={`my-2.5 leading-7 first:mt-0 last:mb-0 ${className ?? ""}`}
      {...props}
    />
  ),
  a: ({ className, ...props }: React.ComponentProps<"a">) => (
    <a
      className={`font-medium text-current underline underline-offset-2 ${className ?? ""}`}
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  ul: ({ className, ...props }: React.ComponentProps<"ul">) => (
    <ul
      className={`my-2.5 ml-5 list-disc space-y-1.5 marker:text-muted-foreground ${className ?? ""}`}
      {...props}
    />
  ),
  ol: ({ className, ...props }: React.ComponentProps<"ol">) => (
    <ol
      className={`my-2.5 ml-5 list-decimal space-y-1.5 marker:text-muted-foreground ${className ?? ""}`}
      {...props}
    />
  ),
  li: ({ className, ...props }: React.ComponentProps<"li">) => (
    <li className={`leading-7 ${className ?? ""}`} {...props} />
  ),
  blockquote: ({ className, ...props }: React.ComponentProps<"blockquote">) => (
    <blockquote
      className={`my-3 border-l-2 border-border pl-4 text-muted-foreground italic ${className ?? ""}`}
      {...props}
    />
  ),
  hr: ({ className, ...props }: React.ComponentProps<"hr">) => (
    <hr className={`my-4 border-border ${className ?? ""}`} {...props} />
  ),
  code: ({ className, ...props }: React.ComponentProps<"code">) => (
    <code
      className={`rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] ${className ?? ""}`}
      {...props}
    />
  ),
  pre: ({ className, ...props }: React.ComponentProps<"pre">) => (
    <pre
      className={`my-3 overflow-x-auto rounded-xl bg-muted p-3.5 text-[0.85em] leading-6 [&>code]:bg-transparent [&>code]:p-0 ${className ?? ""}`}
      {...props}
    />
  ),
  table: ({ className, ...props }: React.ComponentProps<"table">) => (
    <div className="my-3 overflow-x-auto">
      <table
        className={`w-full border-collapse text-sm ${className ?? ""}`}
        {...props}
      />
    </div>
  ),
  th: ({ className, ...props }: React.ComponentProps<"th">) => (
    <th
      className={`border border-border bg-muted px-3 py-1.5 text-left font-semibold ${className ?? ""}`}
      {...props}
    />
  ),
  td: ({ className, ...props }: React.ComponentProps<"td">) => (
    <td
      className={`border border-border px-3 py-1.5 ${className ?? ""}`}
      {...props}
    />
  ),
}

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      components={components}
      className="text-sm break-words text-inherit"
    />
  )
}

export const MarkdownText = memo(MarkdownTextImpl)
