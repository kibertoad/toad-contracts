import { blobBody, blobResponse, noBodyResponse, sseBody, sseResponse } from "@toad-contracts/core";
import { number, object, string } from "valibot";
import { describe, expect, it } from "vitest";
import {
  acceptsSse,
  mocksEmptyBody,
  planMockResponse,
  selectMockBody,
} from "./planMockResponse.ts";

describe("planMockResponse", () => {
  it("treats a bare Standard Schema as an application/json body", () => {
    const schema = object({ id: string() });

    expect(planMockResponse(schema)).toEqual({
      json: { contentType: "application/json", schema },
      primaryKind: "json",
      allowNoBody: false,
    });
  });

  it("reads the media type a factory declared", () => {
    expect(planMockResponse(blobResponse("image/png"))).toMatchObject({
      blob: { contentType: "image/png" },
      primaryKind: "blob",
    });

    const schemaByEventName = { tick: object({ count: number() }) };
    expect(planMockResponse(sseResponse(schemaByEventName))).toMatchObject({
      sse: { schemaByEventName },
      primaryKind: "sse",
    });
  });

  it("collects every kind a content map declares, keeping the first as primary", () => {
    const jsonSchema = object({ id: string() });
    const plan = planMockResponse({
      content: {
        "application/pdf": blobBody(),
        "application/json": jsonSchema,
        "text/event-stream": sseBody({ tick: object({ count: number() }) }),
      },
    });

    expect(plan.primaryKind).toBe("blob");
    expect(plan.blob).toEqual({ contentType: "application/pdf" });
    expect(plan.json).toEqual({ contentType: "application/json", schema: jsonSchema });
    expect(plan.sse).toBeDefined();
  });

  it("keeps the first declared media type of each kind", () => {
    const canonical = object({ id: string() });
    const vendored = object({ legacyId: number() });
    const plan = planMockResponse({
      content: { "application/json": canonical, "application/json+01": vendored },
    });

    expect(plan.json).toEqual({ contentType: "application/json", schema: canonical });
  });

  it("narrows to a single media type when one is preferred", () => {
    const canonical = object({ id: string() });
    const vendored = object({ legacyId: number() });
    const plan = planMockResponse(
      { content: { "application/json": canonical, "application/json+01": vendored } },
      "application/json+01",
    );

    expect(plan.json).toEqual({ contentType: "application/json+01", schema: vendored });
  });

  it("matches the preferred media type the way response resolution does", () => {
    const schema = object({ id: string() });
    const plan = planMockResponse(
      { content: { "application/json": schema, "application/pdf": blobBody() } },
      "Application/JSON; charset=utf-8",
    );

    expect(plan.json).toEqual({ contentType: "application/json", schema });
    expect(plan.blob).toBeUndefined();
  });

  it("throws when the preferred media type is not declared", () => {
    expect(() => planMockResponse(blobResponse("image/png"), "text/plain")).toThrow(
      /Content type 'text\/plain' is not declared.*image\/png/,
    );
  });

  it("marks a no-body entry", () => {
    expect(planMockResponse(noBodyResponse())).toEqual({ allowNoBody: true });
  });

  it("marks an entry that allows an absent body alongside its content", () => {
    const plan = planMockResponse({
      content: { "application/json": object({ id: string() }) },
      allowNoBody: true,
    });

    expect(plan.allowNoBody).toBe(true);
    expect(plan.primaryKind).toBe("json");
  });
});

describe("mocksEmptyBody", () => {
  const plan = planMockResponse({
    content: { "application/json": object({ id: string() }) },
    allowNoBody: true,
  });

  it("is true when an entry allowing an absent body is mocked without one", () => {
    expect(mocksEmptyBody(plan, {})).toBe(true);
  });

  it.each([
    ["responseJson", { responseJson: { id: "1" } }],
    ["responseBlob", { responseBlob: "raw" }],
    ["events", { events: [] }],
  ])("is false when %s is supplied", (_name, params) => {
    expect(mocksEmptyBody(plan, params)).toBe(false);
  });

  it("is false for an entry that does not allow an absent body", () => {
    expect(mocksEmptyBody(planMockResponse(object({ id: string() })), {})).toBe(false);
  });
});

describe("selectMockBody", () => {
  const jsonSchema = object({ id: string() });
  const schemaByEventName = { tick: object({ count: number() }) };

  const dualPlan = (extra?: { allowNoBody?: boolean }) =>
    planMockResponse({
      content: {
        "application/json": jsonSchema,
        "text/event-stream": sseBody(schemaByEventName),
      },
      ...extra,
    });

  it("answers a dual-mode entry by accept when both bodies are mocked", () => {
    const selection = selectMockBody(dualPlan(), { responseJson: { id: "1" }, events: [] });

    expect(selection).toMatchObject({ kind: "dual" });
  });

  it("serves the single body a dual-mode entry was mocked with", () => {
    const plan = dualPlan({ allowNoBody: true });

    expect(selectMockBody(plan, { responseJson: { id: "1" } })).toMatchObject({ kind: "json" });
    expect(selectMockBody(plan, { events: [] })).toMatchObject({ kind: "sse" });
  });

  it("serves the empty body when an entry allowing one is mocked without a body", () => {
    expect(selectMockBody(dualPlan({ allowNoBody: true }), {})).toEqual({ kind: "empty" });
  });

  it("falls back to the first declared media type when no body was supplied", () => {
    expect(selectMockBody(dualPlan(), {})).toMatchObject({ kind: "json" });
    expect(selectMockBody(planMockResponse(noBodyResponse()), {})).toEqual({ kind: "empty" });
  });

  it("serves the empty body for a no-body entry mocked with an explicit null body", () => {
    expect(selectMockBody(planMockResponse(noBodyResponse()), { responseJson: null })).toEqual({
      kind: "empty",
    });
  });

  it("prefers the first declared media type when several bodies are supplied", () => {
    const plan = planMockResponse({
      content: {
        "application/pdf": blobBody(),
        "application/json": jsonSchema,
        "text/event-stream": sseBody(schemaByEventName),
      },
    });

    expect(
      selectMockBody(plan, { responseBlob: "raw", responseJson: { id: "1" }, events: [] }),
    ).toMatchObject({ kind: "blob" });
  });
});

describe("acceptsSse", () => {
  it.each([
    [undefined, false],
    ["application/json", false],
    ["text/event-stream", true],
    ["application/json, text/event-stream;q=0.9", true],
  ])("%s → %s", (header, expected) => {
    expect(acceptsSse(header)).toBe(expected);
  });

  it("handles a repeated accept header", () => {
    expect(acceptsSse(["application/json", "text/event-stream"])).toBe(true);
    expect(acceptsSse(["application/json"])).toBe(false);
  });
});
