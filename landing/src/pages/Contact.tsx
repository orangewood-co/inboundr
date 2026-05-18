import { motion } from "motion/react"
import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"

export default function Contact() {
  return (
    <>
      <PageHeader label="Contact" title="Get in touch" />

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-2 lg:gap-24">
            <FadeIn>
              <p className="label mb-10 text-text-muted">Reach us</p>
              <div className="space-y-8">
                <div>
                  <p className="label-sm text-text-dim">Email</p>
                  <a href="mailto:hello@inboundr.ai" className="mt-1 block text-lg font-medium transition hover:text-green-bright">
                    hello@inboundr.co
                  </a>
                </div>
                <div>
                  <p className="label-sm text-text-dim">Sales inquiries</p>
                  <a href="mailto:sales@inboundr.ai" className="mt-1 block text-lg font-medium transition hover:text-green-bright">
                    sales@inboundr.co
                  </a>
                </div>
                <div>
                  <p className="label-sm text-text-dim">Support</p>
                  <a href="mailto:support@inboundr.ai" className="mt-1 block text-lg font-medium transition hover:text-green-bright">
                    support@inboundr.co
                  </a>
                </div>
                <div>
                  <p className="label-sm text-text-dim">Location</p>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    Remote-first company.<br />
                    Teams in India &amp; US.
                  </p>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={0.12}>
              <p className="label mb-10 text-text-muted">Send a message</p>
              <form
                action="mailto:hello@inboundr.ai"
                method="POST"
                encType="text/plain"
                className="space-y-5"
              >
                <div>
                  <label htmlFor="name" className="label-sm mb-1.5 block text-text-dim">
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
                  <label htmlFor="email" className="label-sm mb-1.5 block text-text-dim">
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
                  <label htmlFor="message" className="label-sm mb-1.5 block text-text-dim">
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
                <motion.button
                  type="submit"
                  className="bg-text px-7 py-3.5 text-sm font-semibold text-base transition hover:shadow-[0_0_30px_rgba(62,207,142,0.15)]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Send message
                </motion.button>
              </form>
            </FadeIn>
          </div>
        </div>
      </section>
    </>
  )
}
