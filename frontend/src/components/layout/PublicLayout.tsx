import { Link, NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, LogIn, Radio } from "lucide-react";

import { useAuth } from "@/hooks";
import { cn } from "@/utils/cn";

import { LiveClock } from "./LiveClock";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

export function PublicLayout() {
  const { user } = useAuth();
  const link = ({ isActive }: { isActive: boolean }) =>
    cn("rounded-xl px-3 py-2 text-sm font-semibold transition", isActive ? "text-navy-900 dark:text-gold-400" : "text-slate-500 hover:text-navy-900 dark:text-slate-400 dark:hover:text-white");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl dark:border-white/5 dark:bg-ink-900/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link to="/"><Logo /></Link>
          <nav className="ml-4 hidden items-center gap-1 md:flex">
            <NavLink to="/" end className={link}>Inicio</NavLink>
            <NavLink to="/en-vivo" className={link}><span className="inline-flex items-center gap-1.5"><Radio className="h-4 w-4 text-crimson-500" />En vivo</span></NavLink>
            <NavLink to="/terminos" className={link}>Términos</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LiveClock className="hidden sm:block" />
            <ThemeToggle />
            {user ? (
              <Link to="/app" className="btn-primary"><LayoutDashboard className="h-4 w-4" /> Panel</Link>
            ) : (
              <Link to="/login" className="btn-primary"><LogIn className="h-4 w-4" /> Ingresar</Link>
            )}
          </div>
        </div>
        <nav className="flex gap-1 border-t border-slate-100 px-4 py-1 md:hidden dark:border-white/5">
          <NavLink to="/" end className={link}>Inicio</NavLink>
          <NavLink to="/en-vivo" className={link}>En vivo</NavLink>
          <NavLink to="/terminos" className={link}>Términos</NavLink>
        </nav>
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-slate-200 bg-white py-8 text-sm text-slate-500 dark:border-white/5 dark:bg-ink-800">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
          <Logo />
          <p className="text-center">© {new Date().getFullYear()} FutOwl · Gestión de torneos en la nube · Hora oficial: Venezuela (UTC-4)</p>
          <Link to="/terminos" className="font-semibold text-navy-700 hover:underline dark:text-gold-400">Términos y condiciones</Link>
        </div>
      </footer>
    </div>
  );
}
