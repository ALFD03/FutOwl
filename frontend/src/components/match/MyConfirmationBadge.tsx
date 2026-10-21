import { CheckCircle2, Clock3, Eye, XCircle } from "lucide-react";

import { Badge, type Tone } from "@/components/ui";
import type { MyConfirmation } from "@/types";

const STATES: Record<MyConfirmation, { tone: Tone; label: string; icon: typeof Clock3; title: string }> = {
  accepted: { tone: "emerald", label: "Confirmaste", icon: CheckCircle2, title: "Ya confirmaste tu asistencia a este partido" },
  rejected: { tone: "crimson", label: "Rechazaste", icon: XCircle, title: "Rechazaste esta asignación" },
  review: { tone: "amber", label: "En revisión", icon: Eye, title: "Tu rechazo está en revisión de las autoridades" },
  pending: { tone: "sky", label: "Por confirmar", icon: Clock3, title: "Aún no confirmas tu asistencia" },
};

/** Respuesta propia del usuario en un partido donde es parte (oficial asignado o gestor de un equipo). */
export function MyConfirmationBadge({ state }: { state: MyConfirmation | null | undefined }) {
  if (!state) return null;
  const { tone, label, icon: Icon, title } = STATES[state];
  return <Badge tone={tone} title={title}><Icon className="h-3 w-3" /> {label}</Badge>;
}
