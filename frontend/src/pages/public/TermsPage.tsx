import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";

import { Card, EmptyState, PageHeader, PageLoader } from "@/components/ui";
import { legal } from "@/services";
import { formatDate } from "@/utils/datetime";
import { Markdown } from "@/utils/markdown";

export function TermsContent() {
  const { data, isLoading } = useQuery({ queryKey: ["terms"], queryFn: legal.current });
  if (isLoading) return <PageLoader />;
  if (!data) return <EmptyState title="No hay términos publicados" />;
  return (
    <>
      <p className="mb-4 text-xs text-slate-500">Versión {data.version} · publicada el {formatDate(data.created_at)}</p>
      <Markdown content={data.content} />
    </>
  );
}

export function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <PageHeader icon={<FileText className="h-6 w-6" />} title="Términos y condiciones" subtitle="Lea atentamente antes de usar la plataforma" />
      <Card><div className="card-body sm:p-8"><TermsContent /></div></Card>
    </div>
  );
}
