import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { ExternalLink } from "lucide-react"

const categories = [
  {
    label: "Infrastructure",
    description: "Core cloud services that power Inboundr's platform.",
    items: [
      {
        name: "Amazon Web Services (AWS)",
        purpose: "Cloud compute, file storage, transactional email (SES), and content delivery",
        location: "India (ap-south-1)",
        href: "https://aws.amazon.com",
      },
    ],
  },
  {
    label: "Database",
    description: "Persistent storage and data management.",
    items: [
      {
        name: "MongoDB Atlas",
        purpose: "Database hosting and storage",
        location: "United States",
        href: "https://www.mongodb.com/atlas",
      },
    ],
  },
  {
    label: "AI Models",
    description: "Third-party AI providers used to power intelligent features.",
    items: [
      {
        name: "OpenAI",
        purpose: "AI language models, document embeddings, voice calls, and transcription",
        location: "United States",
        href: "https://openai.com",
      },
      {
        name: "OpenRouter",
        purpose: "AI model gateway that routes requests to model providers",
        location: "United States",
        href: "https://openrouter.ai",
      },
    ],
  },
  {
    label: "Communications",
    description: "Services that connect Inboundr to your email and phone channels.",
    items: [
      {
        name: "Google",
        purpose: "Sign-in with Google, Gmail inbox sync and sending, and mailbox change notifications (Cloud Pub/Sub)",
        location: "United States",
        href: "https://cloud.google.com",
      },
      {
        name: "Vobiz",
        purpose: "Cloud telephony — phone numbers, call routing, and call recordings",
        location: "India",
        href: "https://vobiz.ai",
      },
    ],
  },
  {
    label: "Analytics & Security",
    description: "Product analytics and abuse prevention.",
    items: [
      {
        name: "PostHog",
        purpose: "Product analytics and usage insights",
        location: "European Union",
        href: "https://posthog.com",
      },
      {
        name: "Cloudflare",
        purpose: "Bot protection (Turnstile) on public forms",
        location: "United States",
        href: "https://www.cloudflare.com",
      },
    ],
  },
]

export default function Subprocessors() {
  return (
    <>
      <title>Subprocessors — Inboundr</title>
      <PageHeader
        label="Legal"
        title="Subprocessors"
        description="The third-party services we rely on to deliver Inboundr."
      >
        <p className="mt-3 text-sm text-text-dim">Last updated: July 17, 2026</p>
      </PageHeader>

      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="text-base leading-relaxed text-text-muted">
              Inboundr uses the following sub-processors to provide its services. We perform due
              diligence on each provider to ensure they meet our security and data protection
              standards. If you have questions about how we handle your data, contact us at{" "}
              <a
                href="mailto:privacy@inboundr.ai"
                className="font-medium text-green-bright transition hover:text-text"
              >
                privacy@inboundr.ai
              </a>
              .
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-20">
          {categories.map((cat, ci) => (
            <FadeIn key={cat.label} delay={ci * 0.08}>
              <div>
                <div className="mb-8 flex items-end justify-between border-b border-border pb-4">
                  <div>
                    <p className="label mb-1 text-green-bright">{cat.label}</p>
                    <p className="text-sm text-text-muted">{cat.description}</p>
                  </div>
                  <span className="label-sm text-text-dim">
                    {cat.items.length} {cat.items.length === 1 ? "provider" : "providers"}
                  </span>
                </div>

                <div className="overflow-hidden border border-border">
                  <div className="noise hidden grid-cols-[1fr_1.4fr_180px] gap-0 bg-surface-raised px-6 py-3 sm:grid">
                    <span className="label-sm text-text-dim">Provider</span>
                    <span className="label-sm pr-8 text-text-dim">Purpose</span>
                    <span className="label-sm text-text-dim">Location</span>
                  </div>

                  {cat.items.map((item, ii) => (
                    <FadeIn key={item.name} delay={ci * 0.08 + ii * 0.05}>
                      <div className="grid grid-cols-1 gap-2 border-t border-border px-6 py-5 transition-colors hover:bg-surface-raised sm:grid-cols-[1fr_1.4fr_180px] sm:items-center sm:gap-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={item.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-center gap-1.5 font-medium text-text transition hover:text-green-bright"
                          >
                            {item.name}
                            <ExternalLink className="size-3 opacity-0 transition group-hover:opacity-60" />
                          </a>
                        </div>
                        <p className="text-sm text-text-muted sm:pr-8">{item.purpose}</p>
                        <p className="text-sm text-text-dim">{item.location}</p>
                      </div>
                    </FadeIn>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="border-t border-border px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FadeIn>
            <p className="label mb-4 text-text-muted">Updates to this list</p>
            <p className="text-sm leading-relaxed text-text-muted">
              We may update this list as our infrastructure evolves. Material changes — such as
              adding a new sub-processor that handles personal data — will be announced at least 10
              days in advance via email to customers. You can also{" "}
              <a
                href="mailto:privacy@inboundr.ai"
                className="font-medium text-green-bright transition hover:text-text"
              >
                contact us
              </a>{" "}
              to request notification of any changes.
            </p>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
