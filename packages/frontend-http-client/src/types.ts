import type { Wretch } from "wretch";

// oxlint-disable-next-line typescript/no-explicit-any -- we don't know which addons Wretch will have, and we don't care, hence any
export type WretchInstance = Wretch<any, unknown, undefined>;
