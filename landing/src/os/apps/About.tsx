import { ArrowUpRight } from "lucide-react"
import { Link } from "react-router-dom"

const values = [
  { title: "Speed is respect", text: "When a customer reaches out, they deserve an instant, competent response — not a 48-hour autoresponder." },
  { title: "Automation with taste", text: "AI should feel like your best employee, not a chatbot. Every interaction we automate passes the 'would I reply to this?' test." },
  { title: "Revenue, not vanity metrics", text: "We measure success in deals closed, not emails sent. If it doesn't move the needle, we don't build it." },
  { title: "Radical transparency", text: "You see every AI action, every decision, every override. No black boxes. Your data stays yours." },
]

export default function AboutApp() {
  return (
    <div className="h-full overflow-y-auto bg-base">
      <header className="border-b border-border px-6 py-8">
        <p className="label-sm mb-3 text-green-bright">Company</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em]">
          About <span className="font-display italic text-gold">Inboundr</span>
        </h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-text-muted">
          We believe every inbound lead deserves an instant, intelligent response — and that AI can
          deliver it better than a team of ten.
        </p>
      </header>

      <section className="border-b border-border px-6 py-7">
        <p className="label-sm mb-4 text-text-muted">Our story</p>
        <div className="space-y-4 text-sm leading-relaxed text-text-muted">
          <p>
            Inboundr was born from a simple observation: companies spend millions generating leads
            but let most of them die in an inbox. We watched sales teams — good ones — lose deals
            because they couldn't reply fast enough, couldn't quote accurately enough, or simply
            forgot to follow up.
          </p>
          <p>
            So we built the AI sales engine we wished existed. One that reads every inquiry the
            moment it arrives, understands what the customer needs, generates an accurate quote
            from the product catalog, and follows up relentlessly until the deal closes — or the
            customer says stop.
          </p>
          <p>We're a small, focused team obsessed with one thing: making sure no inbound lead ever goes unanswered.</p>
        </div>
      </section>

      <section className="px-6 py-7">
        <p className="label-sm mb-4 text-text-muted">What we believe</p>
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {values.map((v) => (
            <div key={v.title} className="bg-base p-5">
              <h3 className="text-sm font-semibold">{v.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-6">
        <p className="text-[13px] text-text-muted">
          We're hiring across engineering, AI, design, and sales.
        </p>
        <Link
          to="/careers"
          target="_blank"
          className="link-underline mt-2 inline-flex items-center gap-1 text-sm font-medium text-green-bright"
        >
          See open roles <ArrowUpRight className="size-3.5" />
        </Link>
      </footer>
    </div>
  )
}
