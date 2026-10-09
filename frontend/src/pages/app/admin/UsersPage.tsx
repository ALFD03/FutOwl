import { useQuery } from "@tanstack/react-query";
import { Unlock, Users } from "lucide-react";

import { ResourcePage } from "@/components/crud/ResourcePage";
import { PermissionPicker, type FieldDef } from "@/components/forms";
import { Avatar, Badge } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import { roles, users, usersExtra } from "@/services";
import type { Role, User } from "@/types";
import { formatDateTime } from "@/utils/datetime";
import { errorMessage } from "@/utils/errors";

export function UsersPage() {
  const toast = useToast();
  const canChange = useCan("accounts.change_user");
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
    { name: "groups", label: "Roles", type: "multiselect", wide: true, section: "Roles y permisos",
      source: { service: roles, label: (r: Role) => r.name, hint: (r: Role) => `${r.permissions.length} permisos` } },
    { name: "user_permissions", label: "Permisos", type: "custom", section: "Roles y permisos", emits: ["user_permissions"],
      initial: (source) => ({ user_permissions: (source?.user_permissions as number[] | undefined) ?? [] }),
      render: ({ values, setValue }) => {
        // Lo que dan los roles elegidos se ve encendido y bloqueado; lo demás es personalización del usuario.
        const fromRoles = new Set((rolesQ.data ?? []).filter((r) => ((values.groups as number[]) ?? []).includes(r.id)).flatMap((r) => r.permissions));
        const custom = ((values.user_permissions as number[]) ?? []).filter((id) => !fromRoles.has(id));
        return (
          <div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Los permisos marcados «Por rol» vienen de los roles elegidos. Encienda otros para personalizar este usuario.</p>
            <PermissionPicker value={custom} locked={fromRoles} onChange={(ids) => setValue("user_permissions", ids)} disabled={!canChange} />
          </div>
        );
      } },
  ];

  return (
    <ResourcePage<User & { is_active: boolean }> title="Usuarios" subtitle="Cuentas, roles y permisos personalizados" icon={<Users className="h-6 w-6" />}
      service={users} model="accounts.user" createLabel="Nuevo usuario" fields={fields} formSize="xl"
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
