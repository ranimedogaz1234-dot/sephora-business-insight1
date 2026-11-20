/** Result of a request that is allowed to fail without failing the whole page. */
export type Settled<T> = { ok: true; value: T } | { ok: false; error: string };

/** Turn a promise into a Settled value so one failing section never breaks the page. */
export const settle = <T>(p: Promise<T>): Promise<Settled<T>> =>
  p.then(
    (value) => ({ ok: true as const, value }),
    (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }),
  );
