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
import { FileTextIcon, InboxIcon, PackageIcon, Settings2Icon } from "lucide-react"

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
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const user = {
    name: session?.user.name ?? "BTSA User",
    email: session?.user.email ?? "Signed in",
    avatar: session?.user.image ?? "",
  }

  return (
    <Sidebar
      className="h-[calc(100svh)]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="relative flex h-10 items-center pt-2 pl-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
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
