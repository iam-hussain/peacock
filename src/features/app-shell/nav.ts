import {
  LayoutDashboard,
  Users,
  HandCoins,
  Store,
  ArrowLeftRight,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Primary app navigation. Desktop shows labels; mobile bottom-nav shows icons.
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Members", href: "/members", icon: Users },
  { label: "Loans", href: "/loans", icon: HandCoins },
  { label: "Vendors", href: "/vendors", icon: Store },
  { label: "Transactions", href: "/transactions", icon: ArrowLeftRight },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

