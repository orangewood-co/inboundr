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
import { resolveUploadedImageUrl } from "@/lib/uploaded-image"
import { getAdminMe } from "@/lib/admin"
import { useEntitlements, type EmployeeAccessModule, type FeatureKey } from "@/lib/entitlements"
import { useOrganizationBranding } from "@/lib/organization-branding"
import { BarChart3Icon, BotMessageSquareIcon, ClipboardListIcon, CrownIcon, FileTextIcon, FolderKanbanIcon, HardDriveIcon, IdCardIcon, InboxIcon, LinkIcon, PackageIcon, ReceiptTextIcon, Settings2Icon, ShoppingCartIcon, UsersIcon } from "lucide-react"

type SidebarNavItem = {
  title: string
  url: string
  icon: React.ReactNode
  feature?: FeatureKey
  module?: EmployeeAccessModule
}

type SidebarCategory = {
  category: string
  items: SidebarNavItem[]
}

const data: { navMain: SidebarCategory[] } = {
  navMain: [
    {
      category: "Quotation",
      items: [
        {
          title: "RFQ",
          url: "/rfq",
          icon: <FileTextIcon />,
          feature: "rfq",
          module: "rfq",
        },
        {
          title: "Inbox",
          url: "/emails",
          icon: <InboxIcon />,
          feature: "rfq",
          module: "inbox",
        },
        {
          title: "Orders",
          url: "/orders",
          icon: <ShoppingCartIcon />,
          feature: "rfq",
          module: "rfq",
        },
      ],
    },
    {
      category: "AI",
      items: [
        {
          title: "Chat",
          url: "/chat",
          icon: <BotMessageSquareIcon />,
        },
      ],
    },
    {
      category: "Business",
      items: [
        {
          title: "Products",
          url: "/products",
          icon: <PackageIcon />,
          module: "products",
        },
        {
          title: "Invoices",
          url: "/invoices",
          icon: <ReceiptTextIcon />,
          feature: "invoices",
          module: "invoices",
        },
        {
          title: "Stats",
          url: "/stats",
          icon: <BarChart3Icon />,
          module: "stats",
        },
        {
          title: "Customers",
          url: "/customers",
          icon: <UsersIcon />,
          module: "customers",
        },
        {
          title: "Employees",
          url: "/employees",
          icon: <IdCardIcon />,
          module: "employees",
        },
        {
          title: "Projects",
          url: "/projects",
          icon: <FolderKanbanIcon />,
          module: "projects",
        },
        {
          title: "Forms",
          url: "/forms",
          icon: <ClipboardListIcon />,
          feature: "forms",
          module: "forms",
        },
        {
          title: "Links",
          url: "/links",
          icon: <LinkIcon />,
          feature: "links",
          module: "links",
        },
        {
          title: "Drive",
          url: "/drive",
          icon: <HardDriveIcon />,
          feature: "drive",
          module: "drive",
        },
      ],
    },
    {
      category: "Admin",
      items: [
        {
          title: "Settings",
          url: "/settings",
          icon: <Settings2Icon />,
        },
      ],
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { data: session } = useSession()
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false)
  const { hasFeature, hasModuleAccess } = useEntitlements()
  const { branding, loading } = useOrganizationBranding()
  const [avatarUrl, setAvatarUrl] = React.useState("")
  const sessionImage = session?.user.image ?? ""
  const user = {
    name: session?.user.name ?? "Inboundr User",
    email: session?.user.email ?? "Signed in",
    avatar: avatarUrl,
  }

  React.useEffect(() => {
    let cancelled = false

    if (!sessionImage) {
      setAvatarUrl("")
      return
    }

    void resolveUploadedImageUrl(sessionImage)
      .then((url) => {
        if (!cancelled) setAvatarUrl(url)
      })
      .catch(() => {
        if (!cancelled) setAvatarUrl("")
      })

    return () => {
      cancelled = true
    }
  }, [sessionImage])
  const organizationName = branding?.name?.trim() || "Inboundr"
  const logoUrl = branding?.logoDisplayUrl?.trim()
  const navCategories = React.useMemo(() => {
    const categories: SidebarCategory[] = data.navMain
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          if (item.feature && !hasFeature(item.feature)) return false
          if (item.module && !hasModuleAccess(item.module)) return false
          return true
        }),
      }))
      .filter((category) => category.items.length > 0)

    if (isSuperAdmin) {
      const adminCategory = categories.find((category) => category.category === "Admin")
      const superAdminItem: SidebarNavItem = {
        title: "Super Admin",
        url: "/admin",
        icon: <CrownIcon />,
      }
      if (adminCategory) {
        adminCategory.items.push(superAdminItem)
      } else {
        categories.push({ category: "Admin", items: [superAdminItem] })
      }
    }

    return categories
  }, [hasFeature, hasModuleAccess, isSuperAdmin])

  React.useEffect(() => {
    void getAdminMe().then(({ isSuperAdmin }) => setIsSuperAdmin(isSuperAdmin))
  }, [])

  return (
    <Sidebar
      className="h-[calc(100svh)]!"
      {...props}
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <a href="/" className="relative flex h-10 items-center pt-2 pl-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:pl-0">
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
              ) : loading ? (
                <div className="h-6 w-24 animate-pulse rounded bg-sidebar-accent" />
              ) : (
                <>
                  <img
                    src="/logo-black.png"
                    alt="Inboundr"
                    className="max-w-30 object-contain opacity-100 transition-[opacity,transform] duration-200 ease-linear group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:opacity-0 dark:hidden"
                  />
                  <img
                    src="/logo.png"
                    alt="Inboundr"
                    className="hidden max-w-30 object-contain opacity-100 transition-[opacity,transform] duration-200 ease-linear group-data-[collapsible=icon]:scale-95 group-data-[collapsible=icon]:opacity-0 dark:block"
                  />
                  <img
                    src="/mark-black.png"
                    alt="Inboundr"
                    className="absolute size-7 scale-90 object-contain opacity-0 transition-[opacity,transform] duration-200 ease-linear group-data-[collapsible=icon]:scale-100 group-data-[collapsible=icon]:opacity-100 dark:hidden"
                  />
                  <img
                    src="/mark.png"
                    alt="Inboundr"
                    className="absolute hidden size-7 scale-90 object-contain opacity-0 transition-[opacity,transform] duration-200 ease-linear group-data-[collapsible=icon]:scale-100 group-data-[collapsible=icon]:opacity-100 dark:block"
                  />
                </>
              )}
            </a>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain categories={navCategories} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
