import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { CircleHelp, ExternalLink, LogOut, Menu, X } from "lucide-react";

import { Avatar } from "@/components/ui";
import { ACCOUNT_ITEMS, NAVIGATION } from "@/config/navigation";
import { useAuth } from "@/hooks";
import { cn } from "@/utils/cn";

import { LiveClock } from "./LiveClock";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can, user, logout } = useAuth();
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 text-slate-300">
      <div className="px-5 py-5">
        <Logo variant="light" />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {NAVIGATION.map((section) => {
          const items = section.items.filter((i) => !i.perm || can(i.perm));
          if (!items.length) return null;
          return (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-gold-400/60">{section.title}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.to}>
                    <NavLink to={item.to} end={item.to === "/app"} onClick={onNavigate}
                      className={({ isActive }) => cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                        isActive ? "bg-white/10 text-white shadow-inner" : "hover:bg-white/5 hover:text-white",
                      )}>
                      {({ isActive }) => (
                        <>
                          <span className={cn("absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gold-400 transition-all duration-300", isActive ? "opacity-100" : "opacity-0")} />
                          <item.icon className={cn("h-[18px] w-[18px] transition-colors", isActive ? "text-gold-400" : "text-slate-400 group-hover:text-gold-300")} />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={`${user?.first_name || user?.username} ${user?.last_name ?? ""}`} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{user?.first_name || user?.username}</p>
            <p className="truncate text-[11px] text-slate-400">{user?.is_superuser ? "Superusuario" : user?.groups.join(", ") || "Sin rol"}</p>
          </div>
          <button onClick={() => void logout()} className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-crimson-400" title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 shadow-lift lg:block">
        <Sidebar />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-navy-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 animate-slide-up shadow-lift">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl sm:px-6 dark:border-white/5 dark:bg-ink-900/80">
        <button className="btn-ghost p-2 lg:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Menú">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="lg:hidden"><Logo compact /></div>
        <div className="ml-auto flex items-center gap-2">
          <LiveClock className="hidden sm:block" />
          <NavLink to="/" className="btn-ghost hidden h-9 px-3 text-xs md:inline-flex" title="Ver sitio público"><ExternalLink className="h-4 w-4" /> Sitio público</NavLink>
          <NavLink to="/app/ayuda" className="btn-ghost h-9 w-9 p-0" title="Ayuda y documentación" aria-label="Ayuda y documentación"><CircleHelp className="h-5 w-5" /></NavLink>
          <ThemeToggle />
          <NotificationBell />
          <NavLink to={ACCOUNT_ITEMS[0].to} className="btn-ghost h-9 w-9 p-0" title="Mi cuenta"><UserIcon /></NavLink>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

function UserIcon() {
  const Icon = ACCOUNT_ITEMS[0].icon;
  return <Icon className="h-5 w-5" />;
}
