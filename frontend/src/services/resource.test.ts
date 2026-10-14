import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.fn();
vi.mock("@/api/client", () => ({ api: { get: (...args: unknown[]) => get(...args) }, toPayload: (d: unknown) => d }));

const { createResource } = await import("./resource");

/** Simula el paginado del backend sobre `total` registros. */
function paginatedBackend(total: number) {
  get.mockImplementation(async (_url: string, { params }: { params: { page: number; page_size: number } }) => {
    const start = (params.page - 1) * params.page_size;
    const results = Array.from({ length: Math.max(0, Math.min(params.page_size, total - start)) }, (_, i) => ({ id: start + i + 1 }));
    return { data: { count: total, next: start + params.page_size < total ? "next" : null, previous: null, results } };
  });
}

describe("createResource().all", () => {
  beforeEach(() => { get.mockReset(); });

  it("trae todas las páginas (inscripción masiva: 50 equipos × 8 categorías)", async () => {
    paginatedBackend(400);
    const rows = await createResource<{ id: number }>("registrations").all({ tournament: 1 });
    expect(rows).toHaveLength(400);
    expect(new Set(rows.map((r) => r.id)).size).toBe(400);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls[0][1].params).toMatchObject({ tournament: 1, page: 1 });
  });

  it("acepta endpoints sin paginación", async () => {
    get.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] });
    expect(await createResource<{ id: number }>("permissions").all()).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
