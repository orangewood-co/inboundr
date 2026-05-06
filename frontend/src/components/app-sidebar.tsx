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
              <div className="flex items-center pt-2 pl-1">
                <img src="/logo.png" alt="logo" className="object-contain max-w-30" />
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
