"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Home, Wallet, ShoppingCart, Images, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Início", icon: Home },
  { href: "/financeiro", label: "Grana", icon: Wallet },
  { href: "/compras", label: "Compras", icon: ShoppingCart },
  { href: "/feed", label: "Feed", icon: Images },
  { href: "/programacao", label: "Roteiro", icon: CalendarDays },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="glass fixed inset-x-0 bottom-0 z-50 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="relative flex flex-col items-center gap-1 px-2 py-2.5 text-[11px] font-medium"
              >
                {active && (
                  <motion.span
                    layoutId="nav-indicator"
                    aria-hidden
                    className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-accent"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon
                  className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden
                />
                <span className={cn(active ? "text-primary" : "text-muted-foreground")}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
