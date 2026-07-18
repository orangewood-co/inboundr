import { FadeIn } from "@/components/FadeIn"
import { PageHeader } from "@/components/PageHeader"
import { blogPosts as posts } from "@/data/blog"

export default function Blog() {
  return (
    <>
      <title>Blog — Inboundr</title>
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
