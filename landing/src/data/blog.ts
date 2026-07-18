export interface BlogPost {
  slug: string
  tag: string
  title: string
  date: string
  excerpt: string
  bg: string
}

export const blogPosts: BlogPost[] = [
  {
    slug: "response-time-conversion",
    tag: "Product",
    title: "Why response time is the #1 predictor of conversion",
    date: "May 8, 2026",
    excerpt: "Harvard Business Review found that companies responding within 5 minutes are 100x more likely to qualify a lead. Here's how Inboundr makes sub-minute response the default.",
    bg: "#1a5c3a",
  },
  {
    slug: "ai-quoting-engine",
    tag: "Engineering",
    title: "Building an AI quoting engine that actually works",
    date: "Apr 22, 2026",
    excerpt: "Matching free-text product requests to structured catalogs is harder than it sounds. A deep dive into our approach to SKU matching, pricing rules, and confidence scoring.",
    bg: "#8a6d1b",
  },
  {
    slug: "end-of-the-sdr",
    tag: "Strategy",
    title: "The end of the SDR as we know it",
    date: "Apr 10, 2026",
    excerpt: "AI is not replacing salespeople — it's replacing the tasks salespeople hate. What the sales org of 2027 looks like and why the best reps are excited, not threatened.",
    bg: "#1a6a5c",
  },
  {
    slug: "distribution-3x-quote-volume",
    tag: "Case Study",
    title: "How a distribution company 3x'd quote volume with zero new hires",
    date: "Mar 28, 2026",
    excerpt: "A mid-market distributor was losing deals to slow quoting. Inboundr cut their average quote time from 2 days to 4 minutes. Here's the full breakdown.",
    bg: "#3a3a0a",
  },
]
