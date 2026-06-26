export * from "@toad-contracts/core";

import {
  type ApiContract,
  describeApiContract as coreDescribeApiContract,
  mapApiContractToPath as coreMapApiContractToPath,
  type RequestObjectSchema,
} from "@toad-contracts/core";

/**
 * Lists the keys of a valibot object schema. Valibot exposes them via `.entries`, which is the
 * object-shape introspection the vendor-neutral Standard Schema interface does not provide.
 *
 * Only plain object schemas (`object`, `strictObject`, `looseObject`, `objectWithRest`) expose
 * `.entries`. A wrapped schema such as `pipe(object(...), ...)` or a non-object schema does not, so
 * we throw an actionable error instead of letting `Object.keys(undefined)` fail cryptically.
 */
const getValibotPathParamKeys = (schema: RequestObjectSchema): string[] => {
  const entries = (schema as { entries?: Record<string, unknown> }).entries;

  if (entries === null || typeof entries !== "object") {
    throw new TypeError(
      "requestPathParamsSchema must be a valibot object schema exposing `.entries` (e.g. " +
        "object({ ... })). Wrapped schemas like pipe(object(...), ...) do not expose object keys " +
        "and cannot be used for path-param mapping.",
    );
  }

  return Object.keys(entries);
};

/**
 * Builds the route's path pattern, replacing each path param with a `:key` placeholder.
 * Drop-in single-argument form of {@link coreMapApiContractToPath}, pre-wired to read the keys of
 * valibot object schemas.
 */
export const mapApiContractToPath = (routeConfig: ApiContract): string =>
  coreMapApiContractToPath(routeConfig, getValibotPathParamKeys);

/**
 * Human-readable `"METHOD /path"` description of a contract. Drop-in single-argument form of
 * {@link coreDescribeApiContract}, pre-wired to read the keys of valibot object schemas.
 */
export const describeApiContract = (routeConfig: ApiContract): string =>
  coreDescribeApiContract(routeConfig, getValibotPathParamKeys);
