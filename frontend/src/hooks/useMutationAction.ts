import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { errorMessage } from "@/utils/errors";

import { useToast } from "./index";

/**
 * Mutación con notificación de éxito/error e invalidación de consultas.
 */
export function useMutationAction<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  options: { success?: string; invalidate?: QueryKey[]; onSuccess?: (result: TResult) => void } = {},
) {
  const toast = useToast();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      if (options.success) toast.success(options.success);
      options.invalidate?.forEach((key) => void queryClient.invalidateQueries({ queryKey: key }));
      options.onSuccess?.(result);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}
