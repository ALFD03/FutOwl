import { Shield } from "lucide-react";

import { cn } from "@/utils/cn";

export function TeamCrest({ src, name, size = "md" }: { src?: string | null; name: string; size?: "sm" | "md" | "lg" | "xl" }) {
  const sizes = { sm: "h-7 w-7", md: "h-10 w-10", lg: "h-16 w-16", xl: "h-24 w-24" };
  return src ? (
    <img src={src} alt={name} className={cn("shrink-0 rounded-full bg-white object-contain p-0.5 shadow-soft ring-1 ring-slate-200 dark:ring-white/10", sizes[size])} loading="lazy" />
  ) : (
    <span className={cn("grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-navy-900 to-navy-600 text-gold-300 shadow-soft", sizes[size])} title={name}>
      <Shield className="h-1/2 w-1/2" />
    </span>
  );
}
