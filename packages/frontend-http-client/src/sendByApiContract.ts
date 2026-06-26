import type {
  ApiContract,
  ClientRequestParams,
  DefaultStreaming,
  HeadersParam,
  InferNonSseClientResponse,
  InferSseClientResponse,
  ResponseKind,
  SseSchemaByEventName,
  SuccessfulHttpStatusCode,
} from "@toad-contracts/core";
import {
  buildRequestPath,
  ContractNoBody,
  hasAnySuccessSseResponse,
  resolveResponseEntry,
} from "@toad-contracts/core";
import { stringify } from "fast-querystring";
import { ServerSentEventTransformStream } from "parse-sse";
import type { ConfiguredMiddleware } from "wretch";
import type { WretchInstance } from "./types.ts";
import { UnexpectedResponseError } from "./UnexpectedResponseError.ts";
import { validate } from "./utils/validation.ts";

export type ContractRequestOptions<DoCaptureAsError extends boolean = boolean> = {
  /**
   * Controls how non-2xx responses defined in the contract are surfaced.
   *
   * - `true` (default): error status codes are returned as `Either.error`, and the result type is
   *   narrowed to success status codes only.
   * - `false`: all status codes defined in `responsesByStatusCode` are returned as `Either.result`.
   *
   * Status codes absent from the contract always surface as `Either.error` regardless of this option.
   */
  captureAsError?: DoCaptureAsError;
  /**
   * When `true` (default), returns an error if the response `content-type` doesn't match the contract entry.
   * When `false`, falls back to the entry's kind for single-entry responses.
   */
  strictContentType?: boolean;
  /**
   * An `AbortSignal` to cancel the in-flight request.
   */
  signal?: AbortSignal;
};

type Either<TError, TResult> =
  | { error: TError; result?: never }
  | { error?: never; result: TResult };

type AllContractResponses<
  TApiContract extends ApiContract,
  TIsStreaming extends boolean,
> = TIsStreaming extends true
  ? InferSseClientResponse<TApiContract>
  : InferNonSseClientResponse<TApiContract>;

// captureAsError: true → success codes only; captureAsError: false → all codes from contract
type ContractResultType<
  TApiContract extends ApiContract,
  TIsStreaming extends boolean,
  TDoCaptureAsError extends boolean,
> = TDoCaptureAsError extends true
  ? Extract<
      AllContractResponses<TApiContract, TIsStreaming>,
      { statusCode: SuccessfulHttpStatusCode }
    >
  : AllContractResponses<TApiContract, TIsStreaming>;

// captureAsError: true → UnexpectedResponseError | <error-status-code responses from contract>
// captureAsError: false → only UnexpectedResponseError (all contract responses go to result)
type ContractErrorType<
  TApiContract extends ApiContract,
  TIsStreaming extends boolean,
  TDoCaptureAsError extends boolean,
> = TDoCaptureAsError extends true
  ?
      | UnexpectedResponseError
      | Exclude<
          AllContractResponses<TApiContract, TIsStreaming>,
          { statusCode: SuccessfulHttpStatusCode }
        >
  : UnexpectedResponseError;

type ReturnTypeForContract<
  TApiContract extends ApiContract,
  TIsStreaming extends boolean,
  TDoCaptureAsError extends boolean,
> = Either<
  ContractErrorType<TApiContract, TIsStreaming, TDoCaptureAsError>,
  ContractResultType<TApiContract, TIsStreaming, TDoCaptureAsError>
>;

const resolveRequestHeaders = <T>(headers: HeadersParam<T>): T | Promise<T> =>
  typeof headers === "function" ? (headers as () => T | Promise<T>)() : headers;

function normalizeResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};

  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return headers;
}

async function* parseSseStream(
  response: Response,
  schemaByEventName: SseSchemaByEventName,
): AsyncGenerator<{ type: string; data: unknown; lastEventId: string; retry: number | undefined }> {
  /* v8 ignore start */
  if (!response.body) {
    throw new Error("Response body is null");
  }
  /* v8 ignore stop */

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new ServerSentEventTransformStream());

  for await (const event of reader) {
    const { type, data, lastEventId, retry } = event;
    const schema = schemaByEventName[type];

    if (!schema) {
      throw new Error(`Schema for event "${type}" not found.`);
    }

    let parsedData: unknown;
    try {
      parsedData = JSON.parse(data);
    } catch (cause) {
      throw new Error(`Failed to parse data for SSE event "${type}" as JSON.`, { cause });
    }

    yield { type, data: await validate(schema, parsedData), lastEventId, retry };
  }
}

async function parseBody(response: Response, resolvedEntry: ResponseKind): Promise<unknown> {
  switch (resolvedEntry.kind) {
    case "noContent":
      return null;
    case "text":
      return await response.text();
    case "blob":
      return await response.blob();
    case "stream":
      return response.body;
    case "json": {
      const json = await response.json();
      return await validate(resolvedEntry.schema, json);
    }
    case "sse":
      return parseSseStream(response, resolvedEntry.schemaByEventName);
  }
}

/**
 * Executes an HTTP request described by `apiContract` and returns a type-safe `Either`.
 *
 * Response bodies are parsed and validated against the Standard Schema defined in
 * `responsesByStatusCode`. Status codes absent from the contract are returned as
 * `Either.error` with an {@link UnexpectedResponseError}.
 *
 * By default (`captureAsError: true`), non-2xx responses defined in the contract are
 * also returned as `Either.error`; pass `captureAsError: false` to receive all
 * contract-defined responses as `Either.result`.
 *
 * @see {@link ContractRequestOptions} for cancellation and other options.
 */
export async function sendByApiContract<
  TApiContract extends ApiContract,
  TIsStreaming extends boolean = DefaultStreaming<TApiContract["responsesByStatusCode"]>,
  TCaptureAsError extends boolean = true,
>(
  wretch: WretchInstance,
  apiContract: TApiContract,
  params: ClientRequestParams<TApiContract, TIsStreaming> & ContractRequestOptions<TCaptureAsError>,
): Promise<ReturnTypeForContract<TApiContract, TIsStreaming, TCaptureAsError>> {
  // oxlint-disable-next-line typescript/no-explicit-any -- params shape depends on the contract's inferred generics
  const anyParams = params as any;

  const useStreaming: boolean = anyParams.streaming ?? hasAnySuccessSseResponse(apiContract);

  const captureAsError = params.captureAsError ?? true;
  const strictContentType = params.strictContentType ?? true;

  // Validate request inputs against the contract's request schemas before sending, applying any
  // declared transforms. Mirrors the response-side validation so a malformed request fails fast
  // with a SchemaValidationError instead of reaching the server.
  const resolvedHeaders = (await resolveRequestHeaders(anyParams.headers)) ?? {};
  const validatedHeaders = apiContract.requestHeaderSchema
    ? await validate(apiContract.requestHeaderSchema, resolvedHeaders)
    : resolvedHeaders;
  const validatedPathParams = apiContract.requestPathParamsSchema
    ? await validate(apiContract.requestPathParamsSchema, anyParams.pathParams)
    : anyParams.pathParams;
  const validatedQueryParams = apiContract.requestQuerySchema
    ? await validate(apiContract.requestQuerySchema, anyParams.queryParams)
    : anyParams.queryParams;
  const validatedBody =
    anyParams.body !== undefined &&
    apiContract.requestBodySchema &&
    apiContract.requestBodySchema !== ContractNoBody
      ? await validate(apiContract.requestBodySchema, anyParams.body)
      : anyParams.body;

  const requestHeaders = new Headers((validatedHeaders as Record<string, string>) ?? {});

  if (validatedBody !== undefined && !requestHeaders.has("content-type")) {
    requestHeaders.set("content-type", "application/json");
  }

  if (useStreaming) {
    const existingAccept = requestHeaders.get("accept");
    if (existingAccept && existingAccept !== "text/event-stream") {
      throw new Error(
        `Cannot use SSE streaming with a custom Accept header ("${existingAccept}"). Remove the header or set it to "text/event-stream".`,
      );
    }
    requestHeaders.set("accept", "text/event-stream");
  }

  const path = buildRequestPath(
    apiContract.pathResolver(validatedPathParams),
    anyParams.pathPrefix,
  );
  const queryString = validatedQueryParams
    ? stringify(validatedQueryParams as Record<string, unknown>)
    : "";
  const fullUrl = queryString ? `${path}?${queryString}` : path;
  // Strings are sent verbatim so a non-JSON content-type (e.g. text/plain) keeps its raw payload;
  // every other body is JSON-encoded.
  const bodyString =
    validatedBody === undefined
      ? undefined
      : typeof validatedBody === "string"
        ? validatedBody
        : JSON.stringify(validatedBody);

  // Middleware that clones the response for non-2xx statuses before wretch consumes the body
  // during WretchError creation, allowing contract-based body parsing even for error responses.
  let clonedErrorResponse: Response | undefined;

  const cloneErrorResponseMiddleware: ConfiguredMiddleware = (next) => async (url, opts) => {
    const fetchResponse = await next(url, opts);
    if (!fetchResponse.ok) {
      clonedErrorResponse = fetchResponse.clone();
    }
    return fetchResponse;
  };

  const wretchInstance = wretch
    .middlewares([cloneErrorResponseMiddleware])
    .url(fullUrl)
    .headers(Object.fromEntries(requestHeaders))
    .options({ signal: params.signal });

  let response: Response;

  try {
    if (apiContract.method === "get" || apiContract.method === "delete") {
      response = await wretchInstance[apiContract.method]().res();
    } else {
      response = await wretchInstance[apiContract.method](bodyString).res();
    }
  } catch (err) {
    if (!clonedErrorResponse) {
      throw err;
    }
    response = clonedErrorResponse;
  }

  const normalizedHeaders = normalizeResponseHeaders(response);
  const contentType = normalizedHeaders["content-type"];

  const resolvedResponseEntry = resolveResponseEntry(
    apiContract.responsesByStatusCode,
    response.status,
    contentType,
    strictContentType,
  );

  if (!resolvedResponseEntry) {
    const body = await response.text();
    return {
      error: new UnexpectedResponseError(response.status, normalizedHeaders, body),
    } as ReturnTypeForContract<TApiContract, TIsStreaming, TCaptureAsError>;
  }

  const parsedBody = await parseBody(response, resolvedResponseEntry);

  // Validate and transform the headers declared in responseHeaderSchema, then merge them over the
  // full set so every raw response header stays accessible. This matches InferClientResponseHeaders,
  // which keeps Record<string, string> for undeclared headers. responseHeaderSchema must be a
  // permissive schema: a strict/exact object would reject the extra headers a real response always
  // carries (date, content-length, and so on).
  const parsedHeaders = apiContract.responseHeaderSchema
    ? {
        ...normalizedHeaders,
        ...((await validate(apiContract.responseHeaderSchema, normalizedHeaders)) as Record<
          string,
          string
        >),
      }
    : normalizedHeaders;

  const parsedResponse = {
    statusCode: response.status,
    headers: parsedHeaders,
    body: parsedBody,
  };

  if (captureAsError && !response.ok) {
    // oxlint-disable-next-line typescript/no-explicit-any -- return type is inferred from TIsStreaming
    return { error: parsedResponse } as any;
  }

  // oxlint-disable-next-line typescript/no-explicit-any -- return type is inferred from TIsStreaming
  return { result: parsedResponse } as any;
}
