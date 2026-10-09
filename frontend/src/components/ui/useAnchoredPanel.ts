import { useCallback, useEffect, useRef, useState } from "react";

export interface PanelCoords {
  top: number;
  left: number;
  width: number;
}

const MARGIN = 8;

/**
 * Panel flotante anclado a un disparador y dibujado en un portal (`position: fixed`).
 *
 * Los modales y las tarjetas recortan con `overflow`, así que un desplegable con `absolute`
 * quedaría cortado; en coordenadas de viewport no. Si no cabe debajo, se abre hacia arriba,
 * y sigue al disparador al hacer scroll (también dentro del modal) o al cambiar el tamaño.
 */
export function useAnchoredPanel<T extends HTMLElement = HTMLButtonElement>({ width, estimatedHeight = 320 }: { width?: number; estimatedHeight?: number } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const triggerRef = useRef<T>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const panelWidth = Math.min(Math.max(width ?? r.width, 200), window.innerWidth - 2 * MARGIN);
    const fitsBelow = r.bottom + MARGIN + estimatedHeight <= window.innerHeight;
    const top = fitsBelow ? r.bottom + 6 : Math.max(MARGIN, r.top - 6 - estimatedHeight);
    const left = Math.max(MARGIN, Math.min(r.left, window.innerWidth - panelWidth - MARGIN));
    setCoords({ top, left, width: panelWidth });
  }, [width, estimatedHeight]);

  const open = useCallback(() => {
    reposition();
    setIsOpen(true);
  }, [reposition]);
  const close = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    if (!isOpen) return;
    // El panel vive en el portal: un clic "fuera" es fuera del disparador y del panel.
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    // Escape cierra solo el desplegable, no el modal que lo contiene.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setIsOpen(false);
      }
    };
    const follow = () => reposition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [isOpen, reposition]);

  return { isOpen, coords, triggerRef, panelRef, open, close, reposition };
}
