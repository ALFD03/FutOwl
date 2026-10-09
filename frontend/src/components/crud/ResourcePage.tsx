import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power, PowerOff } from "lucide-react";

import { ResourceForm, type FieldDef, type Values } from "@/components/forms";
import { Card, DataTable, Modal, PageHeader, Pagination, SearchInput, StatusBadge, type Column } from "@/components/ui";
import { useCan, useToast } from "@/hooks";
import type { Query, ResourceService } from "@/services/resource";
import { errorMessage } from "@/utils/errors";

interface Props<T> {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  service: ResourceService<T>;
  columns: Column<T>[];
  fields: FieldDef[];
  /** Nombre del modelo para los permisos, p. ej. "registry.team" */
  model: string;
  filters?: Query;
  toForm?: (row: T) => Values;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => ReactNode;
  headerActions?: ReactNode;
  createLabel?: string;
  formSize?: "sm" | "md" | "lg";
  embedded?: boolean;
  defaults?: Values;
}

/** Página CRUD genérica: listado con búsqueda, alta/edición y activación (nunca borrado). */
export function ResourcePage<T extends { id: number; is_active?: boolean }>(props: Props<T>) {
  const { service, model, fields, columns, filters } = props;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<T | null | undefined>(undefined);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [app, name] = model.split(".");
  const canAdd = useCan(`${app}.add_${name}`);
  const canChange = useCan(`${app}.change_${name}`);

  const params = { page, search, ...(showInactive ? {} : { is_active: true }), ...filters };
  const { data, isLoading } = useQuery({
    queryKey: [service.path, params],
    queryFn: () => service.list(params),
    placeholderData: keepPreviousData,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [service.path] });

  const save = async (values: Values) => {
    if (editing) await service.update(editing.id, values);
    else await service.create({ ...props.defaults, ...values });
    toast.success(editing ? "Cambios guardados y auditados." : "Registro creado.");
    setEditing(undefined);
    await invalidate();
    void queryClient.invalidateQueries({ queryKey: ["options"] });
  };

  const toggle = async (row: T) => {
    try {
      if (row.is_active) await service.deactivate(row.id);
      else await service.activate(row.id);
      toast.success(row.is_active ? "Registro desactivado." : "Registro reactivado.");
      await invalidate();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const allColumns: Column<T>[] = [
    ...columns,
    {
      key: "_status",
      header: "Estado",
      render: (row) => <StatusBadge status={row.is_active ? "confirmed" : "draft"} label={row.is_active ? "Activo" : "Inactivo"} />,
    },
    {
      key: "_actions",
      header: "",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {props.rowActions?.(row)}
          {canChange && (
            <>
              <button className="btn-ghost btn-sm" onClick={() => setEditing(row)} title="Editar"><Pencil className="h-4 w-4" /></button>
              <button className="btn-ghost btn-sm" onClick={() => toggle(row)} title={row.is_active ? "Desactivar" : "Reactivar"}>
                {row.is_active ? <PowerOff className="h-4 w-4 text-crimson-500" /> : <Power className="h-4 w-4 text-emerald-600" />}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {!props.embedded && (
        <PageHeader title={props.title} subtitle={props.subtitle} icon={props.icon} actions={
          <>
            {props.headerActions}
            {canAdd && <button className="btn-gold" onClick={() => setEditing(null)}><Plus className="h-4 w-4" />{props.createLabel ?? "Nuevo"}</button>}
          </>
        } />
      )}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} />
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-500">
              <input type="checkbox" className="accent-navy-900 dark:accent-gold-500" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
              Mostrar inactivos
            </label>
            {props.embedded && canAdd && <button className="btn-gold btn-sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4" />{props.createLabel ?? "Nuevo"}</button>}
          </div>
        </div>
        <DataTable columns={allColumns} rows={data?.results ?? []} loading={isLoading} onRowClick={props.onRowClick}
          rowClassName={(row) => (row.is_active === false ? "opacity-60" : undefined)} />
        <Pagination page={page} count={data?.count ?? 0} onChange={setPage} />
      </Card>

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)} size={props.formSize ?? "md"}
        title={editing ? `Editar ${props.title.toLowerCase()}` : props.createLabel ?? `Nuevo registro`}
        subtitle="Todos los cambios quedan registrados en la bitácora de auditoría.">
        {editing !== undefined && (
          <ResourceForm key={editing?.id ?? "new"} fields={fields}
            initial={editing ? (props.toForm ? props.toForm(editing) : (editing as unknown as Values)) : props.defaults}
            onSubmit={save} onCancel={() => setEditing(undefined)} />
        )}
      </Modal>
    </div>
  );
}
