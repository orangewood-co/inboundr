"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

type NavItem = {
  title: string
  url: string
  icon: React.ReactNode
}

type NavCategory = {
  category: string
  items: NavItem[]
}

export function NavMain({
  categories,
}: {
  categories: NavCategory[]
}) {
  return (
    <>
      {categories.map((category) => (
        <SidebarGroup key={category.category}>
          <SidebarGroupLabel>{category.category}</SidebarGroupLabel>
          <SidebarMenu>
            {category.items.map((item) => (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  <a href={item.url}>
                    {item.icon}
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
