/**
 * Sentinel marking that a POST/PUT/PATCH contract takes **no request body**.
 *
 * Responses have their own no-body marker: {@link noBodyResponse}.
 *
 * @example
 * defineApiContract({
 *   method: 'post',
 *   requestBodySchema: ContractNoBody,
 *   pathResolver: () => '/reindex',
 *   responsesByStatusCode: { 202: object({ jobId: string() }) },
 * })
 */
export const ContractNoBody = Symbol.for("ContractNoBody");
