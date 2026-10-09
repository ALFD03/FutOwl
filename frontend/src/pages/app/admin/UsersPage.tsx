import { useQuery } from "@tanstack/react-query";
import { Unlock, Users } from "lucide-react";

import { ResourcePage } from "@/components/crud/ResourcePage";
import type { FieldDef } from "@/components/forms";
import { Avatar, Badge } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { permissions, roles, users, usersExtra } from "@/services";
import type { Role, User } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

export function UsersPage() {
  const toast = useToast();
  const canChange = useCan("accounts.change_user");
  const perms = useQuery({ queryKey: ["permissions"], queryFn: permissions.all, staleTime: 300_000 });
  const rolesQ = useQuery({ queryKey: ["roles", "all"], queryFn: () => roles.all() });
  const roleName = (id: number) => rolesQ.data?.find((r) => r.id === id)?.name ?? id;

  const fields: FieldDef[] = [
    { name: "username", label: "Usuario", type: "text", required: true },
    { name: "email", label: "Correo", type: "email" },
    { name: "first_name", label: "Nombres", type: "text" },
    { name: "last_name", label: "Apellidos", type: "text" },
    { name: "phone", label: "Teléfono", type: "phone" },
    { name: "password", label: "Contraseña", type: "password", help: "Obligatoria al crear. Al editar, déjela vacía para no cambiarla." },
    { name: "must_change_password", label: "Cambio obligatorio", type: "checkbox", placeholder: "Exigir cambio de contraseña" },
    { name: "groups", label: "Roles", type: "multiselect", wide: true, section: "Permisos", source: { service: roles, label: (r: Role) => r.name } },
    { name: "user_permissions", label: "Permisos personalizados (adicionales al rol)", type: "multiselect", wide: true, section: "Permisos",
      options: (perms.data ?? []).map((p) => ({ value: p.id, label: p.name })) },
  ];

  return (
    <ResourcePage<User & { is_active: boolean }> title="Usuarios" subtitle="Cuentas, roles y permisos personalizados" icon={<Users className="h-6 w-6" />}
      service={users} model="accounts.user" createLabel="Nuevo usuario" fields={fields} formSize="lg"
      toForm={(u) => ({ ...u, password: "" })}
      rowActions={(u) => canChange && (
        <button className="btn-ghost btn-sm" title="Desbloquear (intentos fallidos)" onClick={async () => {
          try { await usersExtra.unlock(u.id); toast.success("Usuario desbloqueado."); } catch (e) { toast.error(errorMessage(e)); }
        }}><Unlock className="h-4 w-4" /></button>
      )}
      columns={[
        { key: "u", header: "Usuario", render: (u) => <span className="flex items-center gap-3"><Avatar name={`${u.first_name || u.username} ${u.last_name}`} size="sm" /><span><b>{u.username}</b><span className="block text-xs text-slate-500">{u.first_name} {u.last_name} · {u.email}</span></span></span> },
        { key: "g", header: "Roles", render: (u) => u.groups.length ? u.groups.map((g) => <Badge key={g} tone="navy" className="mr-1">{roleName(g)}</Badge>) : <span className="text-slate-400">—</span> },
        { key: "p", header: "Personalizados", render: (u) => u.user_permissions.length || "—" },
        { key: "l", header: "Último acceso", render: (u) => <span className="text-xs">{formatDateTime(u.last_login)}</span> },
      ]} />
  );
}
