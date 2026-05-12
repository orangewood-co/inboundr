import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { ArrowUpRight } from "lucide-react"

const values = [
  { title: "Ship fast, learn faster", text: "We deploy multiple times a day. Mistakes are expected — stagnation isn't." },
  { title: "Customers > code", text: "Every line of code exists to solve a customer's problem. We sit in on sales calls and read support tickets." },
  { title: "Small team, big leverage", text: "We're a handful of people building a product used by thousands. Autonomy and ownership are the default." },
]

const roles = [
  {
    title: "Senior Full-Stack Engineer",
    dept: "Engineering",
    location: "Remote / India",
    type: "Full-time",
  },
  {
    title: "ML Engineer — NLP & Voice",
    dept: "AI",
    location: "Remote / India",
    type: "Full-time",
  },
  {
    title: "Product Designer",
    dept: "Design",
    location: "Remote",
    type: "Full-time",
  },
  {
    title: "Founding Account Executive",
    dept: "Sales",
    location: "Remote / US",
    type: "Full-time",
  },
]

export default function Careers() {
  return (
    <>
      <PageHeader
        label="Company"
        title="Join Inboundr"
        description="We're building the AI revenue engine for inbound sales. Small team, hard problems, massive impact. If you're excited about shipping fast and solving real problems — we'd love to talk."
      />

      <section className="border-y border-border px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">How we work</p>
          </FadeIn>
          <div className="grid gap-0 sm:grid-cols-3">
            {values.map((v, i) => (
              <FadeIn key={v.title} delay={i * 0.08}>
                <div className="border-b border-border p-8 sm:border-b-0 sm:border-r sm:last:border-r-0">
                  <h3 className="text-lg font-bold">{v.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">{v.text}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <FadeIn>
            <p className="mb-12 text-[13px] font-medium uppercase tracking-[0.3em] text-text-muted">Open roles</p>
          </FadeIn>
          {roles.map((r, i) => (
            <FadeIn key={r.title} delay={i * 0.06}>
              <a
                href={`mailto:careers@inboundr.ai?subject=Application: ${r.title}`}
                className="group flex items-center justify-between border-b border-border py-6 transition-colors hover:border-text/15"
              >
                <div>
                  <h3 className="text-lg font-semibold transition-colors group-hover:text-green-bright sm:text-xl">
                    {r.title}
                  </h3>
                  <div className="mt-1 flex gap-3 text-[13px] text-text-dim">
                    <span>{r.dept}</span>
                    <span>&middot;</span>
                    <span>{r.location}</span>
                    <span>&middot;</span>
                    <span>{r.type}</span>
                  </div>
                </div>
                <ArrowUpRight className="size-5 shrink-0 text-text-dim transition-colors group-hover:text-text" />
              </a>
            </FadeIn>
          ))}
          <FadeIn delay={0.3}>
            <p className="mt-12 text-sm text-text-muted">
              Don't see your role? We're always looking for exceptional people.{" "}
              <a href="mailto:careers@inboundr.ai?subject=General Application" className="font-medium text-green-bright transition hover:text-text">
                Send us a note &rarr;
              </a>
            </p>
          </FadeIn>
        </div>
      </section>
    </>
  )
}
