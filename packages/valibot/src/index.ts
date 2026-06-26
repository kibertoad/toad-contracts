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
 */
const getValibotPathParamKeys = (schema: RequestObjectSchema): string[] =>
  Object.keys((schema as unknown as { entries: Record<string, unknown> }).entries);

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
