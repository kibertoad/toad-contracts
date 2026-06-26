import {
  type ApiContract,
  ContractNoBody,
  type InferSchemaInput,
  type InferSseSuccessResponses,
  isAnyOfResponses,
  isBlobResponse,
  isJsonResponse,
  isNoBodyResponse,
  isSseResponse,
  isStreamResponse,
  isTextResponse,
  type RequestPathParamsSchema,
  resolveStatusEntry,
  type SseSchemaByEventName,
  type TypedSseResponse,
} from "@toad-contracts/core";
import { HttpResponse, http, type JsonBodyType } from "msw";
import type { SetupServer } from "msw/node";
import { formatSseResponse, type MockResponseParams, type SseMockEventInput } from "./types.ts";
import {
  validateResponseBody,
  validateSseEvent,
  validateSseEvents,
} from "./validateResponseBody.ts";

type HttpMethod = "get" | "delete" | "post" | "patch" | "put";

/** Controls an on-demand SSE stream registered by {@link MswHelper.mockSseStream}. */
export type SseEventController<S extends SseSchemaByEventName> = {
  /** Emits a single SSE event to every open connection. */
  emit(event: SseMockEventInput<S>): void;
  /** Closes the stream. */
  close(): void;
};

/** Parameters for {@link MswHelper.mockSseStream}. */
export type SseStreamParams<TContract extends ApiContract> =
  (TContract["requestPathParamsSchema"] extends RequestPathParamsSchema
    ? { pathParams: InferSchemaInput<TContract["requestPathParamsSchema"]> }
    : { pathParams?: never }) & {
    responseCode?: number;
    // Required at runtime only for dual-mode contracts, to answer non-SSE requests.
    responseJson?: unknown;
  };

function joinURL(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/**
 * Mocks HTTP responses in [msw](https://mswjs.io)-based tests using contracts defined with
 * `defineApiContract` from `@toad-contracts/core`. Mirrors {@link ApiContractMockttpHelper} but
 * registers handlers on an msw `SetupServer`, which makes it suitable for frontend tests.
 */
export class MswHelper {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private resolvePath(contract: ApiContract, pathParams: unknown): string {
    // The mock always receives concrete `pathParams` for path-param contracts, so the resolver can
    // build the URL directly without introspecting the schema's keys (which the vendor-neutral
    // Standard Schema interface does not expose). Contracts without path params ignore the argument.
    return joinURL(this.baseUrl, contract.pathResolver(pathParams));
  }

  /**
   * Registers a mock handler for the given contract. `responseStatus` selects the contract entry
   * with exact → range → `'default'` precedence; the response body is validated through the
   * contract's Standard Schema before being sent.
   */
  mockResponse<TContract extends ApiContract>(
    contract: TContract,
    server: SetupServer,
    params: MockResponseParams<TContract>,
  ): void {
    // oxlint-disable-next-line typescript/no-explicit-any -- field access is safe; types are enforced by the public signature
    const anyParams = params as any;
    const url = this.resolvePath(contract, anyParams.pathParams);
    const statusCode = anyParams.responseStatus;
    const responseEntry = resolveStatusEntry(contract.responsesByStatusCode, statusCode);

    if (!responseEntry) {
      throw new Error("Specified responseStatus cannot be mapped with contract");
    }

    const method = contract.method as HttpMethod;

    if (responseEntry === ContractNoBody || isNoBodyResponse(responseEntry)) {
      server.use(http[method](url, () => new HttpResponse(null, { status: statusCode })));
      return;
    }

    if (isTextResponse(responseEntry) || isBlobResponse(responseEntry)) {
      const body = isTextResponse(responseEntry) ? anyParams.responseText : anyParams.responseBlob;
      server.use(
        http[method](
          url,
          () =>
            new HttpResponse(body, {
              status: statusCode,
              headers: { "content-type": responseEntry.contentType },
            }),
        ),
      );
      return;
    }

    if (isStreamResponse(responseEntry)) {
      server.use(
        http[method](
          url,
          () =>
            new HttpResponse(anyParams.responseStream, {
              status: statusCode,
              headers: { "content-type": responseEntry.contentType },
            }),
        ),
      );
      return;
    }

    if (isSseResponse(responseEntry)) {
      const body = formatSseResponse(
        validateSseEvents(responseEntry.schemaByEventName, anyParams.events),
      );
      server.use(
        http[method](
          url,
          () =>
            new HttpResponse(body, {
              status: statusCode,
              headers: { "content-type": "text/event-stream" },
            }),
        ),
      );
      return;
    }

    if (isAnyOfResponses(responseEntry)) {
      const sseEntry = responseEntry.responses.find(isSseResponse);
      const jsonEntry = responseEntry.responses.find(isJsonResponse);

      server.use(
        http[method](url, ({ request }) => {
          const accept = request.headers.get("accept") ?? "";

          if (accept.includes("text/event-stream") && sseEntry) {
            return new HttpResponse(
              formatSseResponse(validateSseEvents(sseEntry.schemaByEventName, anyParams.events)),
              {
                status: statusCode,
                headers: { "content-type": "text/event-stream" },
              },
            );
          }

          if (jsonEntry) {
            return HttpResponse.json(
              validateResponseBody(jsonEntry, anyParams.responseJson) as JsonBodyType,
              { status: statusCode },
            );
          }

          return new HttpResponse(null, { status: statusCode });
        }),
      );
      return;
    }

    const jsonSchema = responseEntry;
    server.use(
      http[method](url, () =>
        HttpResponse.json(
          validateResponseBody(jsonSchema, anyParams.responseJson) as JsonBodyType,
          {
            status: statusCode,
          },
        ),
      ),
    );
  }

  /**
   * Registers a streaming SSE handler and returns a controller for emitting events on demand,
   * instead of sending all events at once. Works with SSE and dual-mode contracts; for dual-mode
   * contracts, non-SSE requests receive `params.responseJson`.
   */
  mockSseStream<TContract extends ApiContract>(
    contract: TContract,
    server: SetupServer,
    params?: SseStreamParams<TContract>,
  ): SseEventController<InferSseSuccessResponses<TContract["responsesByStatusCode"]>> {
    const url = this.resolvePath(contract, params?.pathParams);
    const method = contract.method as HttpMethod;
    const status = params?.responseCode ?? 200;
    const encoder = new TextEncoder();

    // Each request gets its own ReadableStream (a stream can only be consumed once); `emit`/`close`
    // fan out to every connection opened against this handler.
    const controllers = new Set<ReadableStreamDefaultController<Uint8Array>>();

    const successEntry = resolveStatusEntry(contract.responsesByStatusCode, status);
    const sseEntry: TypedSseResponse | undefined = successEntry
      ? isSseResponse(successEntry)
        ? successEntry
        : isAnyOfResponses(successEntry)
          ? successEntry.responses.find(isSseResponse)
          : undefined
      : undefined;
    const jsonEntry =
      successEntry && isAnyOfResponses(successEntry)
        ? successEntry.responses.find(isJsonResponse)
        : undefined;

    server.use(
      http[method](url, ({ request }) => {
        if (jsonEntry) {
          const accept = request.headers.get("accept") ?? "";
          if (!accept.includes("text/event-stream")) {
            return HttpResponse.json(
              validateResponseBody(jsonEntry, params?.responseJson) as JsonBodyType,
              { status },
            );
          }
        }

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controllers.add(controller);
          },
        });

        return new HttpResponse(stream, {
          status,
          headers: { "content-type": "text/event-stream" },
        });
      }),
    );

    return {
      emit(event) {
        const validated = sseEntry ? validateSseEvent(sseEntry.schemaByEventName, event) : event;
        const chunk = `event: ${validated.event}\ndata: ${JSON.stringify(validated.data)}\n\n`;
        const bytes = encoder.encode(chunk);
        for (const controller of controllers) {
          controller.enqueue(bytes);
        }
      },
      close() {
        for (const controller of controllers) {
          controller.close();
        }
        controllers.clear();
      },
    };
  }
}
