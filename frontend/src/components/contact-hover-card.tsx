import { BuildingIcon, MailIcon, PhoneIcon, PercentIcon, MapPinIcon } from "lucide-react"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import { getAvatarColor } from "@/lib/utils"
import { CopyableText } from "@/components/copy-button"

interface ContactInfo {
  name: string
  email?: string
  company?: string
  phone?: string
  address?: string
  discount?: number
}

export function ContactHoverCard({
  contact,
  children,
  side = "right",
  align = "start",
}: {
  contact: ContactInfo
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}) {
  const colors = getAvatarColor(contact.name)
  const initial = contact.name.charAt(0).toUpperCase()

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side={side} align={align} className="w-72">
        <div className="flex gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${colors.bg} ${colors.text}`}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-semibold leading-tight">
              {contact.name}
            </p>
            {contact.company && (
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                <BuildingIcon className="size-3 shrink-0" />
                {contact.company}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {contact.email && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MailIcon className="size-3 shrink-0" />
              <CopyableText value={contact.email} label="Email copied">
                <span className="truncate">{contact.email}</span>
              </CopyableText>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <PhoneIcon className="size-3 shrink-0" />
              <CopyableText value={contact.phone} label="Phone copied">
                <span className="truncate">{contact.phone}</span>
              </CopyableText>
            </div>
          )}
          {contact.address && (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPinIcon className="mt-0.5 size-3 shrink-0" />
              <span className="line-clamp-2">{contact.address}</span>
            </div>
          )}
          {contact.discount != null && contact.discount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <PercentIcon className="size-3 shrink-0" />
              <span>{contact.discount}% special discount</span>
            </div>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

export function SenderHoverCard({
  name,
  email,
  children,
  side = "right",
}: {
  name: string
  email: string
  children: React.ReactNode
  side?: "top" | "right" | "bottom" | "left"
}) {
  const colors = getAvatarColor(name)
  const initial = name.charAt(0).toUpperCase()

  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side={side} align="start" className="w-64">
        <div className="flex gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${colors.bg} ${colors.text}`}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-semibold leading-tight">
              {name}
            </p>
            <CopyableText value={email} label="Email copied" className="text-xs text-muted-foreground">
              <span className="truncate">{email}</span>
            </CopyableText>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
