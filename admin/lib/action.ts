/** What every panel action returns to the browser. */
export type ActionResult = {
  ok: boolean;
  /** Shown as a notification on success. */
  message?: string;
  error?: string;
  /** Recovery codes, shown once. */
  codes?: string[];
};

export const fail = (error: string): ActionResult => ({ ok: false, error });
export const done = (message: string): ActionResult => ({ ok: true, message });
