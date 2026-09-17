import { toast } from "sonner";

/**
 * Runs a write and reports the outcome in a toast. Returns whether it
 * succeeded, for callers that navigate or reset state afterwards.
 */
export function useAction() {
  return async (fn: () => Promise<unknown>, ok: string): Promise<boolean> => {
    try {
      await fn();
      toast(ok);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
      return false;
    }
  };
}
