import type { Option } from "./types";

export const VAT_TYPES: Option[] = [
  { value: "V", label: "V" },
  { value: "E", label: "E" },
  { value: "J", label: "J" },
  { value: "G", label: "G" },
];

export const VENEZUELA_STATES = [
  "Amazonas", "Anzoátegui", "Apure", "Aragua", "Barinas", "Bolívar", "Carabobo", "Cojedes", "Delta Amacuro",
  "Distrito Capital", "Falcón", "Guárico", "La Guaira", "Lara", "Mérida", "Miranda", "Monagas", "Nueva Esparta",
  "Portuguesa", "Sucre", "Táchira", "Trujillo", "Yaracuy", "Zulia", "Dependencias Federales",
];

export const LICENSE_OPTIONS: Option[] = [
  { value: "endorsed", label: "Avalado" },
  { value: "not_endorsed", label: "No avalado" },
];

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
export const DOCUMENT_ACCEPT = "application/pdf,.docx,.doc,image/jpeg,image/png,image/webp";
