import { motion } from "motion/react"
import {
  MessageSquareIcon,
  RadioIcon,
  UserSearchIcon,
  PaperclipIcon,
  MicIcon,
  StarIcon,
  CodeIcon,
  InboxIcon,
  BellIcon,
  PaletteIcon,
} from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { CtaSection } from "@/components/CtaSection"

const features = [
  {
    icon: CodeIcon,
    title: "Embeddable chat widget",
    text: "Drop a single chat link or embed onto your website. Visitors start a conversation in one click — no account, no friction.",
    accent: "bg-green/40",
  },
  {
    icon: RadioIcon,
    title: "Realtime team inbox",
    text: "Every conversation streams into Inboundr over a live connection. Replies, status, and typing update instantly on both sides.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: UserSearchIcon,
    title: "Visitor context panel",
    text: "See who you're talking to, their conversation history, shared files, and feedback — right beside the thread you're answering.",
    accent: "bg-[#1a6a5c]/40",
  },
  {
    icon: PaperclipIcon,
    title: "Files & voice messages",
    text: "Visitors and agents can share attachments and record voice notes, so screenshots and quick explanations stay in the conversation.",
    accent: "bg-green/40",
  },
  {
    icon: StarIcon,
    title: "Post-chat feedback",
    text: "When a chat wraps up, visitors can rate the conversation and leave a comment, so you always know how support is landing.",
    accent: "bg-[#8a6d1b]/40",
  },
  {
    icon: PaletteIcon,
    title: "Branded experience",
    text: "The visitor chat picks up your organization name, logo, and brand color, with light and dark modes built in.",
    accent: "bg-[#1a6a5c]/40",
  },
]

const steps = [
  {
    num: "01",
    title: "Share your chat link",
    text: "Copy your public support chat link from Inboundr, or embed it on your site. It's ready the moment your workspace is set up.",
  },
  {
    num: "02",
    title: "A visitor reaches out",
    text: "Someone starts a conversation from your website. They add a few details, then chat in a clean, branded window — desktop or mobile.",
  },
  {
    num: "03",
    title: "Your team replies",
    text: "The conversation lands in the support inbox in realtime. Reply, share files, send voice notes, and track read state and typing as you go.",
  },
  {
    num: "04",
    title: "Context stays attached",
    text: "Files, history, and the visitor's feedback stay on the ticket. Mark it resolved and reopen anytime the conversation picks back up.",
  },
]

const surfaces = [
  { icon: MessageSquareIcon, label: "Website chat" },
  { icon: InboxIcon, label: "Team inbox" },
  { icon: MicIcon, label: "Voice messages" },
  { icon: PaperclipIcon, label: "File sharing" },
  { icon: BellIcon, label: "Realtime updates" },
]

export default function Support() {
  return (
    <>
      <title>Support — Inboundr</title>
      {/* ── Hero ── */}
      <section className="noise relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(62,207,142,0.1),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
          <FadeIn>
            <div className="flex items-center gap-3">
              <span className="inline-block bg-gold px-3 py-1 label-sm text-base">
                New feature
              </span>
              <span className="font-mono text-[13px] text-text-dim">June 2026</span>
            </div>
            <h1 className="mt-8 text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Introducing{" "}
              <span className="font-display italic text-gold">Support</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-text-muted sm:text-xl">
              Live chat for your website, handled inside Inboundr. Add a chat
              widget to your site, and every conversation lands in a realtime
              team inbox — with context, files, and feedback all in one place.
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
              A visitor on your site has a question right now. So you bolt on a
              separate chat tool, conversations scatter across yet another inbox,
              and the context — who they are, what they sent, how it went — never
              makes it back to the rest of your workflow.
            </p>
          </FadeIn>
          <FadeIn delay={0.12}>
            <p className="mt-8 text-xl leading-relaxed sm:text-2xl">
              Support lives inside Inboundr. Visitors chat from a branded widget
              on your website, your team answers from a realtime inbox, and every
              conversation keeps its files, history, and feedback attached.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ── Surfaces strip ── */}
      <section className="border-b border-border px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-10 text-center text-text-dim">
              One conversation, end to end
            </p>
          </FadeIn>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {surfaces.map((s, i) => (
              <FadeIn key={s.label} delay={i * 0.04} className="h-full">
                <div className="flex h-full items-center gap-3 border border-border bg-surface/50 px-4 py-3 text-sm text-text-muted transition-colors hover:border-text/10 hover:text-text">
                  <s.icon className="size-4 shrink-0 text-green-bright" />
                  {s.label}
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
              Everything you need to talk to visitors and stay on top of it.
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
                  Where your visitors and your team finally meet.
                </h2>
                <p className="mt-4 max-w-lg text-sm leading-relaxed text-text-muted">
                  Support sits right next to the customers, deals, and inboxes
                  you already work in Inboundr — so a website chat isn't a
                  detached tool, it's part of the same workflow.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.a
                  href="https://app.inboundr.co/"
                  className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:shadow-[0_0_30px_rgba(62,207,142,0.15)]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Try Support
                </motion.a>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── CTA ── */}
      <CtaSection
        heading="Start chatting with your visitors."
        description="Support is available now in Inboundr. Add a chat widget to your website and answer your first conversation in minutes."
        actions={[
          { label: "Get started free", href: "https://app.inboundr.co/", external: true, icon: "arrow-right" },
          { label: "Talk to us", href: "/contact", variant: "secondary", icon: "arrow-up-right" },
        ]}
      />
    </>
  )
}
