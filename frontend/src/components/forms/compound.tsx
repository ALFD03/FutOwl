/**
 * Campos compuestos para los formularios generados: crear o vincular el usuario de acceso de una
 * ficha y elegir (o crear en el mismo formulario) el representante de un jugador.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Link2, UserPlus, UserX } from "lucide-react";

import { Segmented, SelectMenu, Switch } from "@/components/ui";
import { guardians, users } from "@/services";
import type { Guardian, User } from "@/types";
import { cn } from "@/utils/cn";

import { VatInput } from "./inputs";
import type { CustomFieldContext, FieldDef } from "./types";

function Field({ label, error, help, required, children, wide }: {
  label: string; error?: string; help?: string; required?: boolean; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className={cn(wide && "sm:col-span-2")}>
      <label className="label">{label} {required && <span className="text-crimson-500">*</span>}</label>
      {children}
      {error ? <p className="error-text">{error}</p> : help && <p className="help">{help}</p>}
    </div>
  );
}

function PasswordInput({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input className={cn("input pr-10", invalid && "input-error")} type={visible ? "text" : "password"} autoComplete="new-password"
        value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
        onClick={() => setVisible((v) => !v)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}>
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const loadUsers = async (query: string) =>
  (await users.list({ search: query, is_active: true })).results.map((u: User) => ({
    value: u.id, label: u.username, hint: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email,
  }));

// ------------------------------------------------------------------ Usuario de acceso
type AccountMode = "none" | "existing" | "new";

export const ACCOUNT_KEYS = ["account_mode", "account_user", "account_username", "account_password", "account_email", "account_must_change"];

/**
 * Sección «Usuario de acceso» para fichas que llevan a un usuario (equipo, entrenador, delegado, árbitro).
 * `required`: el usuario es obligatorio al crear (equipos). `multiple`: la ficha admite varios usuarios
 * (equipos), así que al editar la sección sirve para agregar uno más.
 */
export function accountField({ roleLabel, required = false, multiple = false, section = "Usuario de acceso" }: {
  roleLabel: string; required?: boolean; multiple?: boolean; section?: string;
}): FieldDef {
  return {
    name: "account", label: "Usuario de acceso", type: "custom", section, emits: ACCOUNT_KEYS,
    initial: (source) => {
      const linked = !multiple && source?.user;
      return {
        account_mode: linked ? "existing" : required && !source?.id ? "new" : "none",
        account_user: linked ? source.user : null,
        account_label: linked ? source.username : undefined,
        account_username: "", account_password: "", account_email: "", account_must_change: true,
        account_editing: Boolean(source?.id),
      };
    },
    render: (ctx) => <AccountSection ctx={ctx} roleLabel={roleLabel} required={required} multiple={multiple} />,
  };
}

function AccountSection({ ctx, roleLabel, required, multiple }: { ctx: CustomFieldContext; roleLabel: string; required: boolean; multiple: boolean }) {
  const { values, setValue, errors } = ctx;
  const mode = values.account_mode as AccountMode;
  const editing = Boolean(values.account_editing);
  const mandatory = required && !editing;
  const noneLabel = multiple ? (editing ? "Sin cambios" : "Sin usuario") : "Sin usuario";

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/[.02]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {multiple && editing ? "Agregue otro usuario que administre el equipo." : `El usuario recibe el rol «${roleLabel}».`}
        </p>
        {errors.account_mode && <p className="error-text mt-0">{errors.account_mode}</p>}
      </div>
      <Segmented<AccountMode> value={mode} onChange={(v) => setValue("account_mode", v)} options={[
        { value: "none", label: noneLabel, icon: <UserX className="h-3.5 w-3.5" />, disabled: mandatory },
        { value: "existing", label: "Vincular existente", icon: <Link2 className="h-3.5 w-3.5" /> },
        { value: "new", label: "Crear usuario", icon: <UserPlus className="h-3.5 w-3.5" /> },
      ]} />
      {mode === "existing" && (
        <Field label="Usuario" required error={errors.account_user}>
          <SelectMenu value={values.account_user as number | null} load={loadUsers} selectedLabel={values.account_label as string | undefined}
            placeholder="Buscar usuario…" searchPlaceholder="Usuario o nombre…" invalid={Boolean(errors.account_user)}
            onChange={(v, option) => { setValue("account_user", v); setValue("account_label", option?.label); }} />
        </Field>
      )}
      {mode === "new" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombre de usuario" required error={errors.account_username} help="Con este nombre inicia sesión.">
            <input className={cn("input", errors.account_username && "input-error")} autoComplete="off" value={String(values.account_username ?? "")}
              onChange={(e) => setValue("account_username", e.target.value.replace(/\s/g, "").toLowerCase())} />
          </Field>
          <Field label="Correo" error={errors.account_email}>
            <input className={cn("input", errors.account_email && "input-error")} type="email" value={String(values.account_email ?? "")}
              onChange={(e) => setValue("account_email", e.target.value)} />
          </Field>
          <Field label="Contraseña" required error={errors.account_password} help="Mínimo 10 caracteres; no solo números.">
            <PasswordInput value={String(values.account_password ?? "")} invalid={Boolean(errors.account_password)}
              onChange={(v) => setValue("account_password", v)} />
          </Field>
          <div className="flex items-end">
            <Switch checked={Boolean(values.account_must_change)} onChange={(v) => setValue("account_must_change", v)}
              label="Cambiar al primer ingreso" description="Se le pedirá una contraseña propia." />
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Representante
type GuardianMode = "none" | "existing" | "new";

const GUARDIAN_KEYS = ["guardian", "guardian_mode", "guardian_first_name", "guardian_last_name", "guardian_vat_id",
  "guardian_vat_number", "guardian_phone", "guardian_relationship"];

const loadGuardians = async (query: string) =>
  (await guardians.list({ search: query, is_active: true })).results.map((g: Guardian) => ({
    value: g.id, label: `${g.first_name} ${g.last_name}`, hint: [g.vat_display, g.relationship].filter(Boolean).join(" · "),
  }));

const isMinor = (birthDate: unknown) => {
  if (typeof birthDate !== "string" || !birthDate) return false;
  const born = new Date(`${birthDate}T00:00:00`);
  const adult = new Date(born.getFullYear() + 18, born.getMonth(), born.getDate());
  return adult > new Date();
};

/** Representante del jugador: elegirlo de la lista (por nombre o cédula) o registrarlo aquí mismo. */
export const guardianField: FieldDef = {
  name: "guardian", label: "Representante", type: "custom", section: "Representante", emits: GUARDIAN_KEYS,
  initial: (source) => ({
    guardian: source?.guardian ?? null,
    guardian_mode: source?.guardian ? "existing" : "none",
    guardian_first_name: "", guardian_last_name: "", guardian_vat_id: "V", guardian_vat_number: "",
    guardian_phone: "", guardian_relationship: "",
  }),
  render: (ctx) => <GuardianSection ctx={ctx} />,
};

function GuardianSection({ ctx }: { ctx: CustomFieldContext }) {
  const { values, setValue, errors } = ctx;
  const mode = (values.guardian_mode as GuardianMode) ?? "none";
  const minor = isMinor(values.birth_date);
  const selectedId = values.guardian as number | null;
  const { data: selected } = useQuery({
    queryKey: ["guardians", selectedId], queryFn: () => guardians.get(selectedId!), enabled: mode === "existing" && Boolean(selectedId),
  });
  const setMode = (m: GuardianMode) => {
    setValue("guardian_mode", m);
    if (m !== "existing") setValue("guardian", null);
  };
  const text = (key: string) => String(values[key] ?? "");

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-white/10 dark:bg-white/[.02]">
      <p className={cn("text-xs", minor ? "font-semibold text-crimson-600 dark:text-crimson-400" : "text-slate-500 dark:text-slate-400")}>
        {minor ? "Obligatorio: el jugador es menor de 18 años." : "Opcional para jugadores mayores de edad."}
      </p>
      <Segmented<GuardianMode> value={mode} onChange={setMode} options={[
        { value: "none", label: "Sin representante", disabled: minor },
        { value: "existing", label: "Registrado" },
        { value: "new", label: "Nuevo representante" },
      ]} />
      {(errors.guardian) && <p className="error-text">{errors.guardian}</p>}
      {mode === "existing" && (
        <>
          <SelectMenu value={selectedId} load={loadGuardians} placeholder="Buscar por nombre o cédula…" searchPlaceholder="Nombre o cédula…"
            selectedLabel={selected ? `${selected.first_name} ${selected.last_name}` : undefined} invalid={Boolean(errors.guardian)}
            onChange={(v) => setValue("guardian", v)} />
          {selected && (
            <div className="grid animate-fade-in grid-cols-2 gap-3 rounded-xl border border-navy-100 bg-white p-3 text-sm sm:grid-cols-4 dark:border-gold-500/20 dark:bg-ink-800">
              {[["Nombre", `${selected.first_name} ${selected.last_name}`], ["Cédula", selected.vat_display || "—"],
                ["Teléfono", selected.phone || "—"], ["Parentesco", selected.relationship || "—"]].map(([k, v]) => (
                <div key={k}><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</p><p className="font-medium">{v}</p></div>
              ))}
            </div>
          )}
        </>
      )}
      {mode === "new" && (
        <div className="grid animate-fade-in grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nombres" required error={errors.guardian_first_name}>
            <input className={cn("input", errors.guardian_first_name && "input-error")} value={text("guardian_first_name")} onChange={(e) => setValue("guardian_first_name", e.target.value)} />
          </Field>
          <Field label="Apellidos" required error={errors.guardian_last_name}>
            <input className={cn("input", errors.guardian_last_name && "input-error")} value={text("guardian_last_name")} onChange={(e) => setValue("guardian_last_name", e.target.value)} />
          </Field>
          <Field label="Cédula" required error={errors.guardian_vat_number ?? errors.guardian_vat_id}>
            <VatInput type={text("guardian_vat_id") || "V"} number={text("guardian_vat_number")} invalid={Boolean(errors.guardian_vat_number)}
              onType={(v) => setValue("guardian_vat_id", v)} onNumber={(v) => setValue("guardian_vat_number", v)} />
          </Field>
          <Field label="Teléfono" required error={errors.guardian_phone}>
            <input className={cn("input", errors.guardian_phone && "input-error")} type="tel" placeholder="+58 412-1234567" value={text("guardian_phone")}
              onChange={(e) => setValue("guardian_phone", e.target.value.replace(/[^\d+\s-]/g, ""))} />
          </Field>
          <Field label="Parentesco" wide error={errors.guardian_relationship}>
            <input className="input" placeholder="Madre, padre, tutor…" value={text("guardian_relationship")} onChange={(e) => setValue("guardian_relationship", e.target.value)} />
          </Field>
        </div>
      )}
    </div>
  );
}
