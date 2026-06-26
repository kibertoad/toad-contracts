import { type ApiContract, buildRequestPath, ContractNoBody, validate } from "@toad-contracts/core";
import type { AnyHonoApp, RequestByContractParams } from "./types.ts";

const resolveHeaders = async (headers: unknown): Promise<Record<string, string>> => {
  if (typeof headers === "function") {
    return (await headers()) as Record<string, string>;
  }
  return (headers as Record<string, string> | undefined) ?? {};
};

/**
 * Serializes validated query params into a query string. Array values become repeated keys (e.g.
 * `?id=1&id=2`); `undefined`/`null` values are skipped.
 */
const buildQueryString = (query: unknown): string => {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
    } else {
      searchParams.append(key, String(value));
    }
  }

  return searchParams.toString();
};

/**
 * Dispatches a request against a Hono app from a contract, using Hono's native `app.request()` (no
 * server needed). Request inputs are validated and transformed through the contract's request
 * schemas before sending, mirroring the contract client's pre-send validation. The conceptual analog
 * of fastify-api-contracts' `injectByApiContract`, intended for tests.
 *
 * @param app - The Hono app to dispatch against.
 * @param contract - A contract created with `defineApiContract`.
 * @param params - Request params typed from the contract (`pathParams`, `body`, `queryParams`,
 *   `headers` as object or sync/async function, optional `pathPrefix`).
 */
export async function requestByContract<TContract extends ApiContract>(
  app: AnyHonoApp,
  contract: TContract,
  params: RequestByContractParams<TContract>,
): Promise<Response> {
  // oxlint-disable-next-line typescript/no-explicit-any -- params shape depends on the contract's inferred generics
  const anyParams = params as any;

  const resolvedHeaders = await resolveHeaders(anyParams.headers);
  const validatedHeaders = contract.requestHeaderSchema
    ? await validate(contract.requestHeaderSchema, resolvedHeaders)
    : resolvedHeaders;
  const validatedPathParams = contract.requestPathParamsSchema
    ? await validate(contract.requestPathParamsSchema, anyParams.pathParams)
    : anyParams.pathParams;
  const validatedQuery = contract.requestQuerySchema
    ? await validate(contract.requestQuerySchema, anyParams.queryParams)
    : anyParams.queryParams;
  const validatedBody =
    anyParams.body !== undefined &&
    contract.requestBodySchema &&
    contract.requestBodySchema !== ContractNoBody
      ? await validate(contract.requestBodySchema, anyParams.body)
      : anyParams.body;

  const path = buildRequestPath(contract.pathResolver(validatedPathParams), anyParams.pathPrefix);
  const queryString = validatedQuery ? buildQueryString(validatedQuery) : "";
  const url = queryString ? `${path}?${queryString}` : path;

  const headers = new Headers(validatedHeaders as Record<string, string>);
  let body: string | undefined;

  if (validatedBody !== undefined) {
    body = typeof validatedBody === "string" ? validatedBody : JSON.stringify(validatedBody);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
  }

  return app.request(url, { method: contract.method.toUpperCase(), headers, body });
}
