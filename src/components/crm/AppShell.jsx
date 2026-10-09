import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { Menu, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppShell({ brand, subtitle, navItems, children, accentNote }) {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-brand flex items-center justify-center text-primary-foreground font-bold text-base shadow-sm">S</div>
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{brand}</p>
            <p className="text-xs text-muted-foreground leading-tight truncate">{subtitle}</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto scrollbar-thin pb-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                isActive ? "bg-brand text-primary-foreground shadow-sm" : "text-sidebar-foreground hover:bg-sidebar-accent"
              )
            }
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      {accentNote && <div className="mx-3 mb-3 rounded-xl bg-brand-soft/30 p-3 text-xs text-brand-dark leading-relaxed">{accentNote}</div>}
      <div className="px-3 py-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2">
          <div className="h-8 w-8 rounded-full bg-brand-soft flex items-center justify-center text-xs font-semibold text-brand-dark shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{user?.full_name || user?.email}</p>
            <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
          </div>
          <button onClick={() => logout()} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-sidebar border-r border-sidebar-border flex-col">
        {SidebarInner}
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-72 bg-sidebar border-r border-sidebar-border flex flex-col animate-fade-in">{SidebarInner}</aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 h-14 bg-background/80 backdrop-blur border-b border-border">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-muted" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-sm text-muted-foreground hidden sm:block">{subtitle}</p>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}