import { FadeIn } from "@/components/FadeIn"

export default function Contact() {
  return (
    <>
      <section className="noise grid-lines relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_35%_at_50%_0%,rgba(47,93,80,0.2),transparent)]" />
        <div className="relative mx-auto max-w-7xl px-6 pb-20 pt-24 sm:pb-28 sm:pt-32 lg:px-8">
          <FadeIn>
            <p className="mb-5 text-[13px] font-medium uppercase tracking-[0.3em] text-green-bright">Company</p>
            <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-[-0.03em] sm:text-5xl lg:text-6xl">
              Get in touch
            </h1>
          </FadeIn>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <FadeIn>
              <p className="mb-8 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">Reach us</p>
              <div className="space-y-8">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-dim">Email</p>
                  <a href="mailto:hello@inboundr.ai" className="mt-1 block text-lg font-medium transition hover:text-green-bright">
                    hello@inboundr.ai
                  </a>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-dim">Sales inquiries</p>
                  <a href="mailto:sales@inboundr.ai" className="mt-1 block text-lg font-medium transition hover:text-green-bright">
                    sales@inboundr.ai
                  </a>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-dim">Support</p>
                  <a href="mailto:support@inboundr.ai" className="mt-1 block text-lg font-medium transition hover:text-green-bright">
                    support@inboundr.ai
                  </a>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-dim">Location</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    Remote-first company.<br />
                    Teams in India &amp; US.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.12}>
              <p className="mb-8 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">Send a message</p>
              <form
                action="mailto:hello@inboundr.ai"
                method="POST"
                encType="text/plain"
                className="space-y-5"
              >
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.15em] text-text-dim">
                    Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="w-full border border-border bg-surface px-4 py-3 text-sm text-text outline-none transition focus:border-text/30"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.15em] text-text-dim">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    className="w-full border border-border bg-surface px-4 py-3 text-sm text-text outline-none transition focus:border-text/30"
                    placeholder="you@company.com"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.15em] text-text-dim">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    className="w-full resize-none border border-border bg-surface px-4 py-3 text-sm text-text outline-none transition focus:border-text/30"
                    placeholder="Tell us what you're looking for..."
                  />
                </div>
                <button
                  type="submit"
                  className="bg-text px-7 py-3 text-sm font-semibold text-base transition hover:bg-text/90"
                >
                  Send message
                </button>
              </form>
            </FadeIn>
          </div>
        </div>
      </section>
    </>
  )
}
