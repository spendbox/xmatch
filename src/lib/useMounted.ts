"use client";

import { useSyncExternalStore } from "react";

const never = () => () => {};

/**
 * False on the server and while the page first loads, true after. Times and dates use the
 * phone's own clock, language and time zone, so show them only once this is true (otherwise
 * the server's version and the phone's don't match and React throws away the page).
 */
export function useMounted() {
  return useSyncExternalStore(never, () => true, () => false);
}
