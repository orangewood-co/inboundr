import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { Shield, Lock, Eye, Server, FileCheck, Users } from "lucide-react"

const badges = [
  { icon: Shield, label: "SOC 2 Type II", desc: "Annual audit by independent third party" },
  { icon: Lock, label: "AES-256 Encryption", desc: "All data encrypted at rest" },
  { icon: FileCheck, label: "GDPR Compliant", desc: "Full data subject rights support" },
]

const practices = [
  {
    num: "01",
    icon: Lock,
    title: "Encryption everywhere",
    text: "TLS 1.3 in transit. AES-256 at rest. Database-level encryption with customer-isolated keys. No exceptions.",
  },
  {
    num: "02",
    icon: Server,
    title: "Infrastructure isolation",
    text: "Customer data is logically isolated at every layer — compute, storage, and network. No shared databases.",
  },
  {
    num: "03",
    icon: Users,
    title: "Access controls",
    text: "Role-based access with mandatory MFA. All access is logged and auditable. Principle of least privilege enforced.",
  },
  {
    num: "04",
    icon: Eye,
    title: "AI model privacy",
    text: "Your data is never used to train models for other customers. AI processing happens in isolated, ephemeral environments.",
  },
  {
    num: "05",
    icon: FileCheck,
    title: "Data retention & deletion",
    text: "You control retention policies. Upon cancellation, all data is permanently deleted within 30 days. Cryptographic erasure available on request.",
  },
  {
    num: "06",
    icon: Shield,
    title: "Incident response",
    text: "24-hour incident response SLA. Automated threat detection and alerting. Transparent post-incident reports within 72 hours.",
  },
]

export default function Security() {
  return (
    <>
      <PageHeader
        label="Legal"
        title="Security"
        description="Your customer data is the most sensitive asset we handle. Here's how we protect it."
      />

      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">Trust & compliance</p>
          </FadeIn>
          <div className="grid gap-4 sm:grid-cols-3">
            {badges.map((b, i) => (
              <FadeIn key={b.label} delay={i * 0.1}>
                <div className="noise relative overflow-hidden border border-border p-7 sm:p-8">
                  <b.icon className="relative z-10 mb-4 size-6 text-green-bright" />
                  <h3 className="relative z-10 text-lg font-bold">{b.label}</h3>
                  <p className="relative z-10 mt-2 text-sm text-text-muted">{b.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">
              Security practices
            </p>
          </FadeIn>
          {practices.map((p, i) => (
            <FadeIn key={p.num} delay={i * 0.06}>
              <div className="flex gap-6 border-b border-border py-8 sm:gap-10">
                <span className="shrink-0 font-mono text-xs text-text-dim">{p.num}</span>
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <p.icon className="size-4 text-green-bright" />
                    <h3 className="text-xl font-semibold sm:text-2xl">{p.title}</h3>
                  </div>
                  <p className="max-w-lg text-sm leading-relaxed text-text-muted">{p.text}</p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section className="border-t border-border px-6 py-16 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <FadeIn>
            <p className="mb-6 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">Report a vulnerability</p>
            <p className="text-sm leading-relaxed text-text-muted">
              If you've discovered a security vulnerability, please report it responsibly to{" "}
              <a href="mailto:security@inboundr.ai" className="font-medium text-green-bright transition hover:text-text">
                security@inboundr.ai
              </a>
              . We acknowledge all reports within 24 hours and aim to resolve critical issues within 72 hours.
            </p>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
