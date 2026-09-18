import {
  type ApiContract,
  type InferSchemaInput,
  type InferSseSuccessResponses,
  type RequestPathParamsSchema,
  resolveStatusEntry,
  type SseSchemaByEventName,
} from "@toad-contracts/core";
import { HttpResponse, http, type JsonBodyType } from "msw";
import type { SetupServer } from "msw/node";
import {
  acceptsSse,
  type MockJsonTarget,
  type MockSseTarget,
  planMockResponse,
  selectMockBody,
} from "./planMockResponse.ts";
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
    const plan = planMockResponse(responseEntry, anyParams.contentType);
    const selection = selectMockBody(plan, anyParams);

    const jsonHttpResponse = ({ schema, contentType }: MockJsonTarget) =>
      HttpResponse.json(validateResponseBody(schema, anyParams.responseJson) as JsonBodyType, {
        status: statusCode,
        headers: { "content-type": contentType },
      });

    // Events are validated here rather than inside the handler, so an event that violates the
    // contract fails the test at `mockResponse` instead of at request time.
    const sseBodyFor = ({ schemaByEventName }: MockSseTarget) =>
      formatSseResponse(validateSseEvents(schemaByEventName, anyParams.events));

    const sseHttpResponse = (body: string) =>
      new HttpResponse(body, {
        status: statusCode,
        headers: { "content-type": "text/event-stream" },
      });

    switch (selection.kind) {
      case "dual": {
        const { json, sse } = selection;
        const sseBody = sseBodyFor(sse);

        server.use(
          http[method](url, ({ request }) =>
            acceptsSse(request.headers.get("accept") ?? undefined)
              ? sseHttpResponse(sseBody)
              : jsonHttpResponse(json),
          ),
        );
        return;
      }

      case "sse": {
        const sseBody = sseBodyFor(selection.sse);
        server.use(http[method](url, () => sseHttpResponse(sseBody)));
        return;
      }

      case "blob": {
        const { contentType } = selection.blob;
        server.use(
          http[method](
            url,
            () =>
              new HttpResponse(anyParams.responseBlob, {
                status: statusCode,
                headers: { "content-type": contentType },
              }),
          ),
        );
        return;
      }

      case "json": {
        const { json } = selection;
        server.use(http[method](url, () => jsonHttpResponse(json)));
        return;
      }

      case "empty":
        server.use(http[method](url, () => new HttpResponse(null, { status: statusCode })));
        return;
    }
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
    const plan = successEntry ? planMockResponse(successEntry) : undefined;
    // Only a dual-mode entry (SSE *and* JSON on the same status code) needs a JSON fallback here;
    // an SSE-only entry always streams.
    const jsonTarget = plan?.sse ? plan.json : undefined;
    const sseSchemaByEventName = plan?.sse?.schemaByEventName;

    server.use(
      http[method](url, ({ request }) => {
        if (jsonTarget && !acceptsSse(request.headers.get("accept") ?? undefined)) {
          return HttpResponse.json(
            validateResponseBody(jsonTarget.schema, params?.responseJson) as JsonBodyType,
            { status, headers: { "content-type": jsonTarget.contentType } },
          );
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
        const validated = sseSchemaByEventName
          ? validateSseEvent(sseSchemaByEventName, event)
          : event;
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
