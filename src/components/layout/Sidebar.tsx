"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  MessageSquare,
  FileText,
  GraduationCap,
  Sparkles,
  Users,
  Settings,
  Search,
  Plus,
  ChevronDown,
  ClipboardList,
  BarChart3,
  Atom,
  PanelLeftClose,
  User,
  Mail,
  FlaskConical,
  Activity,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isStaff } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserRole } from "@/types";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: UserRole[];
  badge?: string;
  children?: { label: string; href: string }[];
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const mainItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "AI Chat", href: "/chat", icon: MessageSquare },
  { label: "Simulations", href: "/simulations", icon: FlaskConical, badge: "Beta" },
  { label: "Grades", href: "/grades", icon: GraduationCap },
];

const toolItems: NavItem[] = [
  {
    label: "Assignments",
    href: "/assignments",
    icon: FileText,
    children: [
      { label: "All Assignments", href: "/assignments" },
      { label: "Create New", href: "/assignments/create" },
    ],
  },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  {
    label: "Problem Generator",
    href: "/problems/generate",
    icon: Sparkles,
    roles: ["TA", "PROFESSOR", "ADMIN"],
  },
  {
    label: "Grading",
    href: "/grading",
    icon: ClipboardList,
    roles: ["TA", "PROFESSOR", "ADMIN"],
  },
];

const adminItems: NavItem[] = [
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "User Activity", href: "/admin/user-activity", icon: Activity },
  { label: "Email Records", href: "/admin/email-records", icon: Mail },
  { label: "Email Templates", href: "/admin/email-templates", icon: FileText },
  { label: "Scheduled Emails", href: "/admin/scheduled-emails", icon: CalendarClock },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Q&A History", href: "/admin/qa-history", icon: BarChart3 },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onMobileToggle?: (open: boolean) => void;
}

export default function Sidebar({ userRole, userName, collapsed = false, onToggleCollapse, mobileOpen = false, onMobileToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Keyboard shortcut for ⌘K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleExpand = (label: string) => {
    setExpandedItems((prev) =>
      prev.includes(label)
        ? prev.filter((i) => i !== label)
        : [...prev, label]
    );
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const filterByRole = (items: NavItem[]) =>
    items.filter((item) => !item.roles || item.roles.includes(userRole));

  const sections: NavSection[] = [
    { label: "MAIN MENU", items: filterByRole(mainItems) },
    { label: "TOOLS", items: filterByRole(toolItems) },
  ];

  if (isStaff(userRole)) {
    const staffItems = userRole === "ADMIN" || userRole === "PROFESSOR"
      ? adminItems
      : adminItems.filter((item) => item.href === "/admin/qa-history" || item.href === "/admin/users" || item.href === "/admin/email-records");
    sections.push({ label: "ADMIN", items: staffItems });
  }

  // Get all searchable items (flattened)
  const getAllSearchableItems = () => {
    const items: Array<{ id: string; label: string; href: string; icon: React.ElementType; section: string }> = [];
    sections.forEach((section) => {
      section.items.forEach((item) => {
        // Skip parent items that have children (children are listed separately)
        if (!item.children) {
          items.push({ id: `${section.label}-${item.label}`, label: item.label, href: item.href, icon: item.icon, section: section.label });
        }
        if (item.children) {
          item.children.forEach((child) => {
            if (child.href === "/assignments/create") {
              if (isStaff(userRole)) {
                items.push({ id: `${section.label}-${child.label}`, label: child.label, href: child.href, icon: item.icon, section: section.label });
              }
            } else {
              items.push({ id: `${section.label}-${child.label}`, label: child.label, href: child.href, icon: item.icon, section: section.label });
            }
          });
        }
      });
    });
    return items;
  };

  const searchableItems = getAllSearchableItems();
  const filteredSearchItems = searchQuery
    ? searchableItems.filter((item) =>
        item.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchableItems;

  const handleSearchItemClick = (href: string) => {
    // Navigate first, then clean up state
    router.push(href);
    // Close dialog after a brief delay to allow navigation to start
    setTimeout(() => {
      setSearchOpen(false);
      setSearchQuery("");
    }, 100);
  };

  const renderNavItem = (item: NavItem) => {
    const active = isActive(item.href);

    if (item.children && !collapsed) {
      const expanded = expandedItems.includes(item.label);
      return (
        <div key={item.label}>
          <button
            onClick={() => toggleExpand(item.label)}
            className={cn(
              "flex w-full items-center gap-3 rounded-md px-3 py-2 text-body transition-colors",
              active
                ? "bg-sidebar-active font-semibold text-sidebar-foreground"
                : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground"
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className="flex-1 text-left">{item.label}</span>
            <div
              className={cn(
                "transition-transform duration-200",
                expanded ? "rotate-0" : "-rotate-90"
              )}
            >
              <ChevronDown className="h-3.5 w-3.5 text-sidebar-muted" />
            </div>
          </button>
          <div
            className={cn(
              "overflow-hidden transition-all duration-200",
              expanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <div className="ml-8 mt-1 space-y-0.5 border-l border-sidebar-border pl-3">
              {item.children
                .filter((child) => {
                  if (child.href === "/assignments/create") {
                    return isStaff(userRole);
                  }
                  return true;
                })
                .map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-body transition-colors",
                      pathname === child.href
                        ? "font-medium text-sidebar-foreground"
                        : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground"
                    )}
                  >
                    {child.label}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        className={cn(
          "group relative flex items-center gap-3 rounded-md px-3 py-2 text-body transition-colors",
          active
            ? "bg-sidebar-active font-semibold text-sidebar-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:bg-signal before:content-['']"
            : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground",
          collapsed && "justify-center px-2"
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && item.label}
        {!collapsed && item.badge && (
          <span className="ml-auto rounded-sm border border-signal/40 px-1.5 py-0.5 text-label font-medium uppercase text-signal">
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo and collapse */}
      <div className={cn("flex items-center justify-between pt-5 pb-4", collapsed ? "px-3" : "px-5")}>
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
        >
          <Atom className="h-6 w-6 shrink-0 text-signal" />
          {!collapsed && (
            <span className="text-subheading font-semibold tracking-tight text-sidebar-foreground">
              PhysTutor
            </span>
          )}
        </Link>
        <button
          onClick={onToggleCollapse}
          className="hidden h-8 w-8 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground lg:flex"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <PanelLeftClose className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* New Conversation button */}
      <div className={cn("mb-3", collapsed ? "px-2" : "px-4")}>
        <Link href="/chat">
          <Button
            variant="outline"
            className={cn(
              "h-9 w-full justify-center gap-2 rounded-md border-sidebar-border bg-transparent text-body font-medium text-sidebar-foreground hover:bg-sidebar-active hover:text-sidebar-foreground",
              collapsed && "px-0"
            )}
            title="New Conversation"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && "New Conversation"}
          </Button>
        </Link>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="px-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-sidebar-muted" />
            <Input
              placeholder="Search..."
              readOnly
              onClick={() => setSearchOpen(true)}
              className="h-9 cursor-pointer rounded-md border-sidebar-border bg-transparent pl-9 pr-12 text-body text-sidebar-foreground placeholder:text-sidebar-muted"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-2 inline-flex h-5 items-center rounded-sm border border-sidebar-border px-1.5 text-label font-medium text-sidebar-muted">
              &#8984;K
            </kbd>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className={cn("flex-1", collapsed ? "px-1.5" : "px-3")}>
        <nav aria-label="Main navigation">
          <div className="space-y-6 py-1">
            {sections.map((section) => (
              <div key={section.label} role="group" aria-label={section.label}>
                {!collapsed && (
                  <p className="mb-2 px-3 text-label font-medium uppercase text-sidebar-muted">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map(renderNavItem)}
                </div>
              </div>
            ))}
          </div>
        </nav>
      </ScrollArea>

      {/* User profile */}
      <div className={cn("border-t border-sidebar-border", collapsed ? "p-2" : "p-4")}>
        <button
          onClick={() => !collapsed && toggleExpand("__user_menu__")}
          className={cn(
            "flex w-full cursor-pointer items-center rounded-md transition-colors hover:bg-sidebar-active",
            collapsed ? "justify-center p-2" : "gap-3 p-2"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-active text-body font-medium text-sidebar-foreground">
            {userName?.[0]?.toUpperCase() || "U"}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-body font-medium text-sidebar-foreground">
                  {userName}
                </p>
                <p className="text-label uppercase text-sidebar-muted">
                  {userRole}
                </p>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-sidebar-muted transition-transform duration-200",
                expandedItems.includes("__user_menu__") ? "rotate-180" : ""
              )} />
            </>
          )}
        </button>
        {!collapsed && (
          <div className={cn(
            "overflow-hidden transition-all duration-200",
            expandedItems.includes("__user_menu__") ? "max-h-24 opacity-100 mt-1" : "max-h-0 opacity-0"
          )}>
            <div className="space-y-0.5 pl-2">
              <Link
                href="/profile"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-body transition-colors",
                  pathname === "/profile"
                    ? "bg-sidebar-active font-medium text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground"
                )}
              >
                <User className="h-4 w-4" />
                Profile
              </Link>
              <Link
                href="/settings"
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-body transition-colors",
                  pathname === "/settings"
                    ? "bg-sidebar-active font-medium text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground"
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 lg:hidden transition-opacity duration-300",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={() => onMobileToggle?.(false)}
        onKeyDown={(e) => { if (e.key === "Escape") onMobileToggle?.(false); }}
        role="button"
        tabIndex={-1}
        aria-label="Close navigation menu"
      />

      {/* Sidebar */}
      <aside
        aria-label="Main navigation"
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-in-out lg:translate-x-0",
          collapsed ? "lg:w-[68px]" : "lg:w-64",
          mobileOpen ? "translate-x-0 shadow-xl w-64" : "-translate-x-full w-64"
        )}>

        {sidebarContent}
      </aside>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Type to search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1">
                {filteredSearchItems.length === 0 && searchQuery && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No results found for &quot;{searchQuery}&quot;
                  </p>
                )}
                {filteredSearchItems.length === 0 && !searchQuery && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Type to search for pages...
                  </p>
                )}
                {filteredSearchItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSearchItemClick(item.href)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 dark:text-gray-100 font-medium truncate">
                          {item.label}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {item.section}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
