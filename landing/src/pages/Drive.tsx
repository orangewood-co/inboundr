import { motion } from "motion/react"
import {
  FolderUpIcon,
  EyeIcon,
  Users2Icon,
  Share2Icon,
  FolderArchiveIcon,
  Trash2Icon,
  FileTextIcon,
  ImageIcon,
  FileIcon,
  VideoIcon,
  MusicIcon,
  TypeIcon,
} from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { CtaSection } from "@/components/CtaSection"

const features = [
  {
    icon: FolderUpIcon,
    title: "Upload anything",
    text: "Drag and drop files, whole folders, or use the upload button. Multipart uploads handle large files with a live progress queue.",
    accent: "bg-green/40",
  },
  {
    icon: EyeIcon,
    title: "Preview in place",
    text: "Open PDFs, images, documents, video, and audio right in Drive — no downloads, no switching apps to see what's inside.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: Users2Icon,
    title: "Share with your team",
    text: "Give teammates Viewer or Editor access to any file or folder. Everyone sees what's shared with them in one dedicated view.",
    accent: "bg-[#1a6a5c]/40",
  },
  {
    icon: Share2Icon,
    title: "Public view links",
    text: "Send customers a clean, view-only share page. Add a password, and links expire automatically — view-only by default.",
    accent: "bg-green/40",
  },
  {
    icon: FolderArchiveIcon,
    title: "Folder ZIP export",
    text: "Download an entire folder as a single ZIP archive with one click — for you or for external recipients on a share page.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: Trash2Icon,
    title: "Trash & restore",
    text: "Move items to Trash, restore them when you need them back, or delete forever when you're ready. Nothing disappears by accident.",
    accent: "bg-[#1a6a5c]/40",
  },
]

const steps = [
  {
    num: "01",
    title: "Upload and organize",
    text: "Drag files or folders straight into Drive, create folders, and arrange your tree. Switch between list and grid views as you like.",
  },
  {
    num: "02",
    title: "Find it fast",
    text: "Search across names and contents, navigate with breadcrumbs, and jump between My files, Shared with me, and Trash in a click.",
  },
  {
    num: "03",
    title: "Share securely",
    text: "Invite teammates as Viewers or Editors, or generate a password-protected public link that customers can browse and download from.",
  },
  {
    num: "04",
    title: "Keep it tidy",
    text: "Rename, move, and bulk-select items. Export folders as ZIP, trash what you don't need, and restore anything that's not gone for good.",
  },
]

const previewTypes = [
  { icon: FileIcon, label: "PDF" },
  { icon: ImageIcon, label: "Images" },
  { icon: FileTextIcon, label: "Documents" },
  { icon: VideoIcon, label: "Video" },
  { icon: MusicIcon, label: "Audio" },
  { icon: TypeIcon, label: "Text" },
]

export default function Drive() {
  return (
    <>
      <title>Drive — Inboundr</title>
      {/* ── Hero ── */}
      <section className="noise grid-lines relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(62,207,142,0.1),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
          <FadeIn>
            <div className="flex items-center gap-3">
              <span className="inline-block bg-gold px-3 py-1 label-sm text-base">
                Feature
              </span>
              <span className="font-mono text-[13px] text-text-dim">March 2026</span>
            </div>
            <h1 className="mt-8 text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Introducing{" "}
              <span className="font-display italic text-gold">Drive</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted sm:text-xl">
              A file workspace, built right into Inboundr. Store, preview, and
              organize files and folders — then share them with your team or your
              customers, on your terms.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Overview ── */}
      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="label-sm mb-4 text-green-bright">
              Why we built this
            </p>
          </FadeIn>
          <FadeIn delay={0.06}>
            <p className="text-xl leading-relaxed text-text-muted sm:text-2xl">
              Catalogs, contracts, quotes, customer documents — they end up
              scattered across desktops, email attachments, and someone else's
              cloud drive. When you need a file, you're hunting through three
              tools, and sharing it with a customer means another disconnected
              link.
            </p>
          </FadeIn>
          <FadeIn delay={0.12}>
            <p className="mt-8 text-xl leading-relaxed sm:text-2xl">
              Drive lives inside Inboundr. Upload files, organize them into
              folders, preview without downloading, and share with teammates or
              customers — all next to the deals and customers they belong to.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Preview types strip ── */}
      <section className="border-b border-border px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-10 text-center text-text-dim">
              Preview without downloading
            </p>
          </FadeIn>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previewTypes.map((p, i) => (
              <FadeIn key={p.label} delay={i * 0.04}>
                <div className="flex items-center gap-3 border border-border bg-surface/50 px-4 py-3 text-sm text-text-muted transition-colors hover:border-text/10 hover:text-text">
                  <p.icon className="size-4 shrink-0 text-green-bright" />
                  {p.label}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-4 text-text-muted">
              What's included
            </p>
            <h2 className="max-w-xl text-3xl font-bold leading-snug tracking-[-0.02em] sm:text-4xl">
              Everything you need to store, organize, and share files.
            </h2>
          </FadeIn>
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {features.map((f, i) => (
              <FadeIn key={f.title} delay={i * 0.06}>
                <div className="group flex h-full flex-col border border-border p-7 card-hover sm:p-8">
                  <div className={`mb-4 flex size-10 items-center justify-center ${f.accent}`}>
                    <f.icon className="size-5 text-text" />
                  </div>
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">
                    {f.text}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-10 text-text-muted">
              How it works
            </p>
          </FadeIn>
          {steps.map((s, i) => (
            <FadeIn key={s.num} delay={i * 0.06}>
              <div className="group flex gap-6 border-b border-border py-8 sm:gap-10">
                <span className="shrink-0 font-mono text-xs text-text-dim">
                  {s.num}
                </span>
                <div>
                  <h3 className="text-xl font-semibold sm:text-2xl">{s.title}</h3>
                  <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-muted">
                    {s.text}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Highlight banner ── */}
      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <FadeIn>
          <div className="noise relative mx-auto max-w-4xl overflow-hidden bg-green p-10 sm:p-14">
            <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[1fr_auto]">
              <div>
                <p className="label-sm text-text-muted">
                  Built for Inboundr
                </p>
                <h2 className="mt-3 text-2xl font-bold leading-snug sm:text-3xl">
                  Your files, right where the work happens.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-text-muted">
                  Keep catalogs, contracts, and customer documents in the same
                  place as your deals and conversations. Share a folder with a
                  customer in seconds — no external drive, no lost attachments.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.a
                  href="https://app.inboundr.co/"
                  className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:shadow-[0_0_30px_rgba(62,207,142,0.15)]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Drive
                </motion.a>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA ── */}
      <CtaSection
        heading="Bring your files into Inboundr."
        description="Drive is available now for all Inboundr users. Upload your first files and share them in minutes."
        actions={[
          { label: "Get started free", href: "https://app.inboundr.co/", external: true, icon: "arrow-right" },
          { label: "Talk to us", href: "/contact", variant: "secondary", icon: "arrow-up-right" },
        ]}
      />
    </>
  )
}
