/**
 * Canonical result type for server actions.
 *
 * Mutations should return ActionResult<void>; queries that can fail
 * should return ActionResult<T>. This gives call sites a predictable
 * shape without having to catch thrown errors.
 *
 * Usage in an action:
 *   export async function addSemester(name: string): Promise<ActionResult<void>> {
 *     try { ... return { ok: true, data: undefined }; }
 *     catch (e: unknown) { return { ok: false, error: String(e instanceof Error ? e.message : e) }; }
 *   }
 *
 * Usage in a client component:
 *   const result = await addSemester(name);
 *   if (!result.ok) { toast.error(result.error); return; }
 *   toast.success('Done');
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Convenience constant for successful void actions. */
export const OK: ActionResult<void> = { ok: true, data: undefined };

/**
 * Wraps an async function in a try/catch and returns an ActionResult.
 * Use this to safely convert throwing actions without boilerplate.
 *
 * Example:
 *   return withActionResult(() => supabaseAdmin.from('...').insert({ ... }));
 */
export async function withActionResult<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    return { ok: false, error };
  }
}
