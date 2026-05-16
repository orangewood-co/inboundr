import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useSession } from "@/lib/auth-client"
import { useOrganizationBranding } from "@/lib/organization-branding"
import { BarChart3Icon, ClipboardListIcon, FileTextIcon, InboxIcon, LinkIcon, PackageIcon, Settings2Icon, UsersIcon } from "lucide-react"

const data = {
  navMain: [
    {
      title: "RFQ",
      url: "/",
      icon: <FileTextIcon />,
      isActive: true,
    },
    {
      title: "Inbox",
      url: "/emails",
      icon: <InboxIcon />,
    },
    {
      title: "Products",
      url: "/products",
      icon: <PackageIcon />,
    },
    {
      title: "Stats",
      url: "/stats",
      icon: <BarChart3Icon />,
    },
    {
      title: "Customers",
      url: "/customers",
      icon: <UsersIcon />,
    },
    {
      title: "Forms",
      url: "/forms",
      icon: <ClipboardListIcon />,
    },
    {
      title: "Links",
      url: "/links",
      icon: <LinkIcon />,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const { branding } = useOrganizationBranding()
  const user = {
    name: session?.user.name ?? "BTSA User",
    email: session?.user.email ?? "Signed in",
    avatar: session?.user.image ?? "",
  }
  const organizationName = branding?.name?.trim() || "Inboundr"
  const logoUrl = branding?.logoDisplayUrl?.trim()

  return (
    <Sidebar
      className="h-[calc(100svh)]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="relative flex h-10 items-center pt-2 pl-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
              {logoUrl ? (
                <>
                  <img
                    src={logoUrl}
                    alt={`${organizationName} logo`}
                    className="max-h-8 max-w-34 object-contain opacity-100 transition-[opacity,transform] duration-200 ease-linear group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:opacity-0"
                  />
                  <div className="absolute flex size-8 scale-90 items-center justify-center overflow-hidden rounded-lg bg-sidebar-primary/10 opacity-0 transition-[opacity,transform] duration-200 ease-linear group-data-[collapsible=icon]:scale-100 group-data-[collapsible=icon]:opacity-100">
                    <img
                      src={logoUrl}
                      alt={`${organizationName} mark`}
                      className="max-h-6 max-w-6 object-contain"
                    />
                  </div>
                </>
              ) : (
                <>
                  <img
                    src="/logo.png"
                    alt="Inboundr"
                    className="max-w-30 object-contain opacity-100 transition-[opacity,transform] duration-200 ease-linear group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:opacity-0"
                  />
                  <img
                    src="/mark.png"
                    alt="Inboundr"
                    className="absolute size-7 scale-90 object-contain opacity-0 transition-[opacity,transform] duration-200 ease-linear group-data-[collapsible=icon]:scale-100 group-data-[collapsible=icon]:opacity-100"
                  />
                </>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
