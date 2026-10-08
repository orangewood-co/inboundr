import { Link } from "react-router-dom"
import {
  ArrowUpRight,
  ClipboardList,
  FolderOpen,
  Link2,
  MessagesSquare,
  Package,
  ReceiptText,
  Users,
  type LucideIcon,
} from "lucide-react"
import { FadeIn } from "@/components/FadeIn"
import { features, type FeatureSlug } from "@/data/features"

const icons: Record<FeatureSlug, LucideIcon> = {
  assets: Package,
  support: MessagesSquare,
  invoices: ReceiptText,
  forms: ClipboardList,
  employees: Users,
  drive: FolderOpen,
  links: Link2,
}

export function FeatureGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {features.map((feature, i) => {
        const Icon = icons[feature.slug]
        const isNew = feature.tag === "New"
        return (
          <FadeIn
            key={feature.slug}
            delay={(i % 4) * 0.08}
            className={`flex ${isNew ? "sm:col-span-2" : ""}`}
          >
            <Link
              to={`/features/${feature.slug}`}
              className="group flex flex-1 flex-col overflow-hidden border border-border bg-surface card-hover"
            >
              <div
                className="noise relative flex h-28 items-end overflow-hidden p-7 sm:h-36 sm:p-8"
                style={{ backgroundColor: feature.bg }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(255,255,255,0.1),transparent_55%),linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.15))]" />
                <span className="relative z-10 flex size-10 items-center justify-center bg-white/10 ring-1 ring-inset ring-white/15">
                  <Icon className="size-5 text-white" strokeWidth={1.5} />
                </span>
                {isNew && (
                  <span className="absolute right-7 top-7 z-10 bg-gold px-2.5 py-1 label-sm text-base sm:right-8 sm:top-8">
                    New
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-7 sm:p-8">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-[-0.01em] transition-colors duration-200 group-hover:text-green-bright">
                    {feature.title}
                  </h3>
                  <ArrowUpRight className="size-5 shrink-0 text-text-dim transition-[color,translate] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-text" />
                </div>
                <p className="mt-2 text-pretty text-sm leading-relaxed text-text-muted">{feature.summary}</p>
              </div>
            </Link>
          </FadeIn>
        )
      })}
    </div>
  )
}
