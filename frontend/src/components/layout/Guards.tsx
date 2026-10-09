import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { EmptyState, PageLoader } from "@/components/ui";
import { useAuth } from "@/hooks";

/** Requiere sesión iniciada y términos aceptados. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader label="Verificando sesión…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!user.terms_accepted && location.pathname !== "/aceptar-terminos") return <Navigate to="/aceptar-terminos" replace />;
  return <>{children}</>;
}

/** Muestra el contenido solo si el usuario tiene el permiso indicado. */
export function RequirePerm({ perm, children, mode = "all" }: { perm: string | string[]; children: ReactNode; mode?: "all" | "any" }) {
  const { can } = useAuth();
  if (!can(perm, mode)) {
    return <EmptyState icon={<ShieldAlert className="h-7 w-7" />} title="Acceso restringido" message="No tiene permisos para ver esta sección. Contacte a un administrador." />;
  }
  return <>{children}</>;
}

/** Renderiza hijos solo si hay permiso (para botones/acciones). */
export function Can({ perm, children, mode = "all" }: { perm: string | string[]; children: ReactNode; mode?: "all" | "any" }) {
  const { can } = useAuth();
  return can(perm, mode) ? <>{children}</> : null;
}
