import { BarChart2, Home, Layers, Search, Settings } from "lucide-react";

export const navItems = [
  { name: "首页", href: "/app", icon: Home },
  { name: "牌组", href: "/decks", icon: Layers },
  { name: "易混词", href: "/confusions", icon: Search },
  { name: "统计", href: "/stats", icon: BarChart2 },
  { name: "设置", href: "/settings", icon: Settings },
];
