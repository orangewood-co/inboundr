export interface PressRelease {
  slug: string
  tag: string
  title: string
  date: string
  dateISO: string
  readTime: string
  excerpt: string
  body: string[]
  pullQuote?: {
    quote: string
    attribution: string
  }
  bg: string
}

export interface NewsItem {
  outlet: string
  headline: string
  date: string
  href: string
}

// Most recent first. The first entry is treated as the featured release.
export const pressReleases: PressRelease[] = [
  {
    slug: "inboundr-launches-ai-voice-agent",
    tag: "Product",
    title: "Inboundr launches its AI Voice Agent for inbound calls",
    date: "June 3, 2026",
    dateISO: "2026-06-03",
    readTime: "4 min read",
    excerpt:
      "The release extends Inboundr from text and email into live phone conversations — answering inbound calls, qualifying the caller, pulling up the CRM, and quoting in real time, then logging every detail automatically.",
    body: [
      "Inboundr today announced its AI Voice Agent, bringing the company's inbound automation to the one channel it had not yet touched: the phone. The Voice Agent answers inbound calls in under two rings, understands what the caller needs, and handles the conversation end to end — from qualification to a live quote — without a human in the loop.",
      "Until now, Inboundr replied to inbound leads across web forms, email, and chat. But for a large share of small and mid-market businesses, the phone is still where deals start and stall. Calls go to voicemail after hours, get bounced between reps, or simply never get returned. The Voice Agent closes that gap.",
      "On a live call, the agent recognizes the caller, surfaces their history from the AI CRM, answers product and pricing questions, and can generate and read back an accurate quote drawn straight from the catalog. When the conversation ends, every detail — transcript, intent, next step — is written back automatically, so nothing is lost and no rep has to take notes.",
      "The Voice Agent is available today to all Inboundr customers as part of the Calls product, with no additional setup beyond connecting a number. It speaks naturally, hands off to a human the moment a caller asks, and respects the same guardrails teams already configure for text and email.",
    ],
    pullQuote: {
      quote:
        "Every missed call is a missed deal. The Voice Agent means an inbound caller gets an instant, competent answer at 2pm or 2am — the same standard we already set for email and chat.",
      attribution: "Inboundr founding team",
    },
    bg: "#1a5c3a",
  },
  {
    slug: "inboundr-introduces-ai-quoting-engine",
    tag: "Product",
    title: "Inboundr introduces the AI Quoting Engine",
    date: "May 27, 2026",
    dateISO: "2026-05-27",
    readTime: "3 min read",
    excerpt:
      "Inboundr can now turn a free-text request into an accurate, catalog-priced quote in seconds — matching messy customer language to the right SKUs, applying pricing rules, and flagging anything it is unsure about.",
    body: [
      "Inboundr today launched its AI Quoting Engine, a system that reads an inbound request in plain language and returns a structured, accurately priced quote in seconds. It is built for businesses that sell from a catalog and lose deals to slow, manual quoting.",
      "Matching what a customer actually wrote — partial product names, quantities, substitutions, and all — to a structured catalog is deceptively hard. The Quoting Engine handles SKU matching, applies pricing and discount rules, and attaches a confidence score to every line so teams know exactly when to trust the output and when to glance at it first.",
      "In early use, customers cut their average quote turnaround from days to minutes while keeping a human approval step wherever they want one. The engine is available now inside the Quotes product and plugs into the same inbound pipeline that already drafts replies and follow-ups.",
    ],
    pullQuote: {
      quote:
        "A quote that arrives two days late is just a polite rejection. We made accurate quoting fast enough to win the deal.",
      attribution: "Inboundr founding team",
    },
    bg: "#8a6d1b",
  },
  {
    slug: "inboundr-one-million-conversations",
    tag: "Milestone",
    title: "Inboundr surpasses one million inbound conversations handled by AI",
    date: "April 15, 2026",
    dateISO: "2026-04-15",
    readTime: "2 min read",
    excerpt:
      "A milestone for the AI sales engine: more than a million inbound leads across thousands of businesses have now been answered, qualified, quoted, or followed up by Inboundr.",
    body: [
      "Inboundr has now handled more than one million inbound conversations on behalf of the businesses that use it — a milestone reached roughly a year after the product's first customers went live.",
      "Those conversations span web forms, email, chat, and now phone calls, across thousands of small and mid-market companies. Every one of them was read, understood, and acted on automatically: a reply drafted, a lead qualified, a quote generated, or a follow-up sent — usually within a minute of the customer reaching out.",
      "The number the team cares about most is not the million; it is the response time behind it. The median inbound lead on Inboundr now gets a substantive first response in under sixty seconds, at any hour.",
    ],
    bg: "#1a6a5c",
  },
  {
    slug: "inboundr-opens-platform-api",
    tag: "Platform",
    title: "Inboundr opens its platform with a public API and CRM integrations",
    date: "March 4, 2026",
    dateISO: "2026-03-04",
    readTime: "3 min read",
    excerpt:
      "Inboundr now connects to the rest of the stack — a public API plus native integrations with the CRMs, help desks, and tools teams already run — so automated inbound actions stay in sync everywhere.",
    body: [
      "Inboundr today opened its platform to developers and operators with a public API and a first set of native integrations, letting teams wire automated inbound actions into the tools they already use.",
      "Every reply, qualification, quote, and follow-up Inboundr performs can now flow into a team's CRM and help desk, and external systems can trigger Inboundr actions in return. The goal is simple: keep the AI's work and the team's system of record perfectly in sync, with no copy-paste in between.",
      "The API and integrations are available now. Inboundr remains radically transparent by design — every automated action is logged and reversible, and customer data stays the customer's.",
    ],
    bg: "#3a3a0a",
  },
]

export const newsItems: NewsItem[] = [
  {
    outlet: "TechCrunch",
    headline: "Inboundr wants every inbound lead answered in under a minute",
    date: "May 2026",
    href: "#",
  },
  {
    outlet: "VentureBeat",
    headline: "Inboundr brings AI voice agents to SMB phone lines",
    date: "June 2026",
    href: "#",
  },
  {
    outlet: "The Information",
    headline: "The rise of agentic sales: a look inside Inboundr",
    date: "April 2026",
    href: "#",
  },
  {
    outlet: "Forbes",
    headline: "How AI is quietly rewriting the inbound sales playbook",
    date: "March 2026",
    href: "#",
  },
  {
    outlet: "SaaStr",
    headline: "Inboundr on turning response time into revenue",
    date: "February 2026",
    href: "#",
  },
  {
    outlet: "Product Hunt",
    headline: "Inboundr named #1 Product of the Day",
    date: "January 2026",
    href: "#",
  },
  {
    outlet: "The GTM Podcast",
    headline: "Episode 142: Inboundr's founder on the changing role of the SDR",
    date: "December 2025",
    href: "#",
  },
  {
    outlet: "Sifted",
    headline: "The startups automating sales follow-up, ranked",
    date: "November 2025",
    href: "#",
  },
]

export const boilerplate140 =
  "Inboundr is the AI sales engine that replies, quotes, follows up, and closes inbound leads — automatically, in under a minute, at any hour."

export const boilerplate =
  "Inboundr is the AI sales engine for inbound revenue. It reads every inquiry the moment it arrives — across web forms, email, chat, and phone — understands what the customer needs, drafts an accurate reply, generates a catalog-priced quote, and follows up relentlessly until the deal closes or the customer says stop. Built for small and mid-market teams, Inboundr pairs an AI CRM with auto-reply, quoting, follow-ups, and voice agents behind a single, radically transparent system: every automated action is logged, reversible, and yours. Inboundr is a remote-first company with teams in India and the US."

export function getReleaseBySlug(slug: string | undefined): PressRelease | undefined {
  return pressReleases.find((release) => release.slug === slug)
}
