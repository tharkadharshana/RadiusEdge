
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
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle"; 

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  subItems?: NavItem[];
  segment?: string; // For matching active route with children
}

const navItems: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ai-assistant", label: "AI Assistant", icon: Bot },
  { href: "/scenarios", label: "Scenario Builder", icon: Waypoints },
  { href: "/packets", label: "Packet Editor", icon: FilePenLine },
  { href: "/dictionaries", label: "Dictionaries", icon: BookText },
  // { href: "/import", label: "Packet Importer", icon: UploadCloud }, // Removed
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
  const { open, state } = useSidebar();

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
          {state === "expanded" && (
            <h1 className="text-xl font-semibold text-foreground">RadiusEdge</h1>
          )}
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
                  // For Shadcn Sidebar, we might need to handle sub-menu toggle explicitly
                  // This example uses a simple link for parent, better would be Accordion behavior
                >
                  <item.icon className="h-5 w-5" />
                  {state === "expanded" && <span>{item.label}</span>}
                </SidebarMenuButton>
                {open && state === 'expanded' && ( // Only show sub-menu if sidebar is open and expanded
                  <SidebarMenuSub>
                    {item.subItems.map((subItem) => (
                      <SidebarMenuItem key={subItem.label}>
                        <Link href={subItem.href} legacyBehavior passHref>
                          <SidebarMenuSubButton
                            isActive={isActive(subItem.href)}
                            className="justify-start gap-2"
                            asChild
                          >
                            <a> {/* Content of the link */}
                              <subItem.icon className="h-4 w-4" />
                              <span>{subItem.label}</span>
                            </a>
                          </SidebarMenuSubButton>
                        </Link>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenuSub>
                )}
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem key={item.label}>
                <Link href={item.href} legacyBehavior passHref>
                  <SidebarMenuButton
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    className="justify-start"
                    asChild
                  >
                    <a> {/* Content of the link */}
                      <item.icon className="h-5 w-5" />
                      {state === "expanded" && <span>{item.label}</span>}
                    </a>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )
          )}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-4">
        {/* You can add items to the footer, e.g., quick help or user profile short */}
        {state === "collapsed" && (
          <ThemeToggle />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
