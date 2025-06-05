"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  ListTree,
  FilePenLine,
  BookText,
  BarChart3,
  TerminalSquare,
  Settings,
  Server,
  Waypoints,
  DatabaseZap,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar";
import { SheetTitle } from "@/components/ui/sheet";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle"; 

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  subItems?: NavItem[];
  segment?: string;
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
  { href: "/scenarios", label: "Scenario Builder", icon: Waypoints },
  { href: "/packets", label: "Packet Editor", icon: FilePenLine },
  { href: "/dictionaries", label: "Dictionaries", icon: BookText },
  { href: "/results", label: "Results Dashboard", icon: BarChart3 },
  { href: "/execute", label: "Execution Console", icon: TerminalSquare },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    segment: "settings",
    subItems: [
      { href: "/settings/servers", label: "Server Config", icon: Server },
      { href: "/settings/database", label: "DB Validation", icon: DatabaseZap },
      { href: "/settings/users", label: "User Management", icon: Users },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { open, state, isMobile } = useSidebar();

  const isActive = (href: string, segment?: string) => {
    if (segment) {
      return pathname.startsWith(`/${segment}`);
    }
    return pathname === href;
  };

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-8 w-8 text-primary" />
          {isMobile ? (
            <SheetTitle asChild> 
              <h1 className="text-xl font-semibold text-foreground">RadiusEdge</h1>
            </SheetTitle>
          ) : state === "expanded" ? (
            <h1 className="text-xl font-semibold text-foreground">RadiusEdge</h1>
          ) : null}
        </Link>
      </SidebarHeader>
      <SidebarContent className="flex-1 p-2">
        <SidebarMenu>
          {navItems.map((item) =>
            item.subItems ? (
              <SidebarMenuItem key={item.label} data-orientation="vertical">
                <SidebarMenuButton
                  isActive={isActive(item.href, item.segment)}
                  tooltip={item.label}
                  className="justify-start"
                >
                  <item.icon className="h-5 w-5" />
                  {state === "expanded" && <span>{item.label}</span>}
                </SidebarMenuButton>
                {(state === 'expanded' && !isMobile) && ( 
                  <SidebarMenuSub>
                    {item.subItems.map((subItem) => (
                      <SidebarMenuItem key={subItem.label}>
                          <SidebarMenuSubButton
                          asChild
                            isActive={isActive(subItem.href)}
                            className="justify-start gap-2"
                          >
                          <Link href={subItem.href}>
                              <subItem.icon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                          </Link>
                          </SidebarMenuSubButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton
                  asChild
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    className="justify-start"
                  >
                  <Link href={item.href}>
                      <item.icon className="h-5 w-5" />
                      {state === "expanded" && <span>{item.label}</span>}
                  </Link>
                  </SidebarMenuButton>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {state === "collapsed" && !isMobile && (
          <ThemeToggle />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
