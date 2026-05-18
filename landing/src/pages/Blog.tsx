import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"

const posts = [
  {
    tag: "Product",
    title: "Why response time is the #1 predictor of conversion",
    date: "May 8, 2026",
    excerpt: "Harvard Business Review found that companies responding within 5 minutes are 100x more likely to qualify a lead. Here's how Inboundr makes sub-minute response the default.",
    bg: "#1a5c3a",
  },
  {
    tag: "Engineering",
    title: "Building an AI quoting engine that actually works",
    date: "Apr 22, 2026",
    excerpt: "Matching free-text product requests to structured catalogs is harder than it sounds. A deep dive into our approach to SKU matching, pricing rules, and confidence scoring.",
    bg: "#8a6d1b",
  },
  {
    tag: "Strategy",
    title: "The end of the SDR as we know it",
    date: "Apr 10, 2026",
    excerpt: "AI is not replacing salespeople — it's replacing the tasks salespeople hate. What the sales org of 2027 looks like and why the best reps are excited, not threatened.",
    bg: "#1a6a5c",
  },
  {
    tag: "Case Study",
    title: "How a distribution company 3x'd quote volume with zero new hires",
    date: "Mar 28, 2026",
    excerpt: "A mid-market distributor was losing deals to slow quoting. Inboundr cut their average quote time from 2 days to 4 minutes. Here's the full breakdown.",
    bg: "#3a3a0a",
  },
]

export default function Blog() {
  return (
    <>
      <PageHeader
        label="Company"
        title="Blog"
        description="Thinking on AI sales, inbound automation, and building the future of customer engagement."
      />

      <section className="px-6 py-20 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 sm:grid-cols-2">
            {posts.map((post, i) => (
              <FadeIn key={post.title} delay={i * 0.1}>
                <article className="noise group relative flex h-full flex-col overflow-hidden border border-border card-hover">
                  <div className="relative z-10 flex flex-1 flex-col p-7 sm:p-8">
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        className="noise relative overflow-hidden px-2.5 py-0.5 label-sm"
                        style={{ backgroundColor: post.bg }}
                      >
                        <span className="relative z-10">{post.tag}</span>
                      </span>
                      <span className="font-mono text-[11px] text-text-dim">{post.date}</span>
                    </div>
                    <h2 className="text-xl font-bold leading-snug transition-colors group-hover:text-green-bright sm:text-2xl">
                      {post.title}
                    </h2>
                    <p className="mt-3 flex-1 text-sm leading-relaxed text-text-muted">{post.excerpt}</p>
                    <p className="mt-6 label text-text-dim transition-colors group-hover:text-text">
                      Read more &rarr;
                    </p>
                  </div>
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
