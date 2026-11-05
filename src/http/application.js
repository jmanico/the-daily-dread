import Fastify from 'fastify';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { InputFailure, parseQuery } from './input.js';
import { parseBody, ParserUnavailable } from './parse-body.js';
import { errorProjection as projection, errorSchema, errorStatuses, isErrorStatus } from '../contracts/http-results.js';
import { createDiagnosticCapture, diagnosticOptions, bindDiagnostics, recordHttpOutcome, recordIngressRejection } from '../audit/http-diagnostics.js';

/** @typedef {'allowed' | 'unauthenticated' | 'forbidden' | 'unavailable' | 'conflict'} Access */
/** @typedef {import('fastify').FastifyRequest} Request */
const invalidQuery = Object.freeze({});
/** @type {WeakMap<Request, {controller: AbortController, deadline: number}>} */
const operations = new WeakMap();
/** Pass this owned signal through the use case to its adapters. Fastify's request.signal is not used.
 * @param {Request} request */
export function operationSignal(request) {
  const operation = operations.get(request);
  if (!operation) return AbortSignal.abort();
  if (performance.now() >= operation.deadline) operation.controller.abort();
  return operation.controller.signal;
}
export class HttpFailure extends Error {
  /** @param {number} status */
  constructor(status) { super('Request rejected'); this.status = isErrorStatus(status) ? status : 503; }
}
/** Native framing failures never serialize the parser's rawPacket or error.
 * @param {import('node:stream').Duplex} socket @param {import('../audit/http-diagnostics.js').Capture} diagnostics */
function rejectSocket(socket,diagnostics) {
  if (socket.destroyed || !socket.writable || socket.writableEnded) return;
  const id=randomUUID();recordIngressRejection(diagnostics,id);
  const body = JSON.stringify(projection(400, id));
  socket.end(`HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}
/** @param {import('node:http').ServerResponse} response @param {import('../audit/http-diagnostics.js').Capture} diagnostics */
function rejectExpectation(response,diagnostics) {
  const id=randomUUID();recordIngressRejection(diagnostics,id);
  const body = JSON.stringify(projection(400, id));
  response.writeHead(400, { Connection: 'close', 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) });
  response.end(body);
}

/** Composition-only factory. No routes, authentication implementation or listener is installed here.
 * The trusted access owner authenticates/coarsely authorizes before body parsing; use cases still
 * recheck object/property authority and revisions at the commitment boundary.
 * @param {(request: Request) => Promise<Access>} authorize
 * @param {import('../audit/http-diagnostics.js').Capture} [diagnostics] */
export function createApplication(authorize,diagnostics=createDiagnosticCapture()) {
  if (typeof authorize !== 'function') throw new Error('An access owner is required');
  const routes=new Set();
  /** @type {WeakMap<Request,{id:string,start:number,method:string,route:string}>} */ const observations=new WeakMap();
  /** @param {Request} request @param {number|undefined} status */
  function observeEnd(request,status) {
    const observation=observations.get(request);if(!observation)return;
    observations.delete(request);
    recordHttpOutcome(diagnostics,observation.id,observation.method,observation.route,status,Math.max(0,Math.floor(performance.now()-observation.start)));
  }
  const app = Fastify({
    logger: diagnosticOptions(diagnostics), trustProxy: false, requestIdHeader: false,
    genReqId: () => randomUUID(), bodyLimit: 65536,
    onProtoPoisoning: 'error', onConstructorPoisoning: 'error',
    ajv: { customOptions: { coerceTypes: false, useDefaults: false, removeAdditional: false, allErrors: false } },
    routerOptions: { querystringParser(text) { try { return parseQuery(text); } catch { return invalidQuery; } } },
    clientErrorHandler(_error, socket) { rejectSocket(socket,diagnostics); },
    frameworkErrors(error, request, reply) {
      const status = error.code === 'FST_ERR_BAD_URL' || error.code === 'FST_ERR_MAX_PARAM_LENGTH' ? 400 : 503;
      recordIngressRejection(diagnostics,request.id,status);
      const body = JSON.stringify(projection(status, request.id));
      reply.raw.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' });
      reply.raw.end(body);
    },
    serverFactory(handler) {
      const server = createServer({ maxHeaderSize: 16384, insecureHTTPParser: false,
        headersTimeout: 10000, requestTimeout: 30000, connectionsCheckingInterval: 500,
        keepAliveTimeout: 5000, keepAliveTimeoutBuffer: 0 }, handler);
      server.maxHeadersCount = 0; // Retain all bounded headers, then reject >100 instead of truncating.
      server.maxRequestsPerSocket = 100; server.maxConnections = 200;
      server.setTimeout(30000, socket => socket.destroy());
      server.on('checkContinue', (_request, response) => rejectExpectation(response,diagnostics));
      server.on('checkExpectation', (_request, response) => rejectExpectation(response,diagnostics));
      server.on('upgrade', (_request, socket) => rejectSocket(socket,diagnostics));
      server.on('connect', (_request, socket) => rejectSocket(socket,diagnostics));
      return server;
    },
  });
  bindDiagnostics(diagnostics,app.log);
  app.decorate('diagnosticCapture',diagnostics);
  app.addHook('onRoute', route => {
    if(typeof route.url!=='string' || route.url.length>256 || !/^\/[A-Za-z0-9_/:.*-]*$/.test(route.url)) throw new Error('Invalid diagnostic route template');
    routes.add(route.url);
    // The selected Fastify request.signal/handlerTimeout path has upstream bugs #7047/#7069.
    // The application owns the same mandatory deadline below; enabling that path is forbidden.
    if (route.handlerTimeout !== undefined) throw new Error('Use the application operation deadline');
    const configured = route.schema?.response;
    if (configured !== undefined && (typeof configured !== 'object' || configured === null || Array.isArray(configured))) throw new Error('Invalid response schemas');
    /** @type {Record<string, unknown>} */
    const responses = { ...configured }; // Code-owned route configuration, never request fields.
    for (const status of errorStatuses) responses[String(status)] = structuredClone(errorSchema);
    route.schema = { ...route.schema, response: responses };
  });
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 65536 },
    async (/** @type {Request} */ request, /** @type {Buffer} */ bytes) => parseBody(bytes, operationSignal(request)));
  app.addHook('onRequest', async (request, reply) => {
    const template=request.routeOptions.url;
    const route=typeof template==='string' && routes.has(template) ? template : 'unmatched';
    const method=['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS','CONNECT','TRACE'].includes(request.method) ? request.method : 'OTHER';
    observations.set(request,{id:request.id,start:performance.now(),method,route});
    const controller = new AbortController();
    operations.set(request, { controller, deadline: performance.now() + 10000 });
    const timer = setTimeout(() => {
      controller.abort();
      if (reply.raw.writableEnded || reply.raw.destroyed) return;
      if (reply.raw.headersSent) { reply.raw.destroy(); return; }
      const body = JSON.stringify(projection(503, request.id));
      reply.raw.writeHead(503, { Connection: 'close', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
      reply.raw.end(body);
    }, 10000);
    const abort = () => controller.abort();
    const cleanup = () => {
      clearTimeout(timer); request.raw.removeListener('aborted', abort);
      reply.raw.removeListener('close', closed); reply.raw.removeListener('finish', cleanup);
      operations.delete(request); abort();
    };
    const closed = () => { if (!reply.raw.writableFinished) {abort();observeEnd(request,undefined);} cleanup(); };
    request.raw.once('aborted', abort); reply.raw.once('close', closed); reply.raw.once('finish', cleanup);
    if (request.raw.aborted || reply.raw.destroyed) abort();
    reply.raw.setHeader('Cache-Control', 'no-store'); reply.raw.setHeader('X-Content-Type-Options', 'nosniff'); reply.raw.setHeader('Referrer-Policy', 'no-referrer');
    const names = new Set();
    if (request.raw.rawHeaders.length > 200) throw new HttpFailure(400);
    for (let i = 0; i < request.raw.rawHeaders.length; i += 2) {
      const name = request.raw.rawHeaders[i].toLowerCase();
      if (names.has(name)) throw new HttpFailure(400);
      names.add(name);
    }
    if (request.query === invalidQuery || request.headers.trailer !== undefined ||
      (request.headers['transfer-encoding'] !== undefined && request.headers['transfer-encoding'] !== 'chunked')) throw new HttpFailure(400);
    let decision;
    try { decision = await authorize(request); } catch { throw new HttpFailure(503); }
    if (operationSignal(request).aborted) throw new HttpFailure(503);
    if (decision !== 'allowed') throw new HttpFailure(decision === 'unauthenticated' ? 401 : decision === 'forbidden' ? 403 : decision === 'unavailable' ? 404 : decision === 'conflict' ? 409 : 503);
    const media = request.headers['content-type'];
    if (request.headers['content-encoding'] !== undefined ||
      (['POST', 'PUT', 'PATCH'].includes(request.method) && media === undefined) ||
      (media !== undefined && !/^application\/json(?:;\s*charset=utf-8)?$/i.test(media))) throw new HttpFailure(415);
  });
  app.addHook('onResponse',async (request,reply)=>{observeEnd(request,reply.statusCode);});
  app.addHook('preValidation', async request => {
    if (request.raw.rawTrailers?.length) throw new HttpFailure(400);
    if (operationSignal(request).aborted) throw new HttpFailure(503);
  });
  app.setErrorHandler((error, request, reply) => {
    const validation = error instanceof Error && 'validation' in error && Array.isArray(error.validation);
    const code = error instanceof Error && 'code' in error ? error.code : undefined;
    const context = error instanceof Error && 'validationContext' in error ? error.validationContext : undefined;
    const field = context === 'body' || context === 'querystring' || context === 'params' || context === 'headers' ? context : 'request';
    const status = error instanceof HttpFailure ? error.status : error instanceof InputFailure ? 400 :
      error instanceof ParserUnavailable ? 503 : validation ? 422 :
      code === 'FST_ERR_CTP_BODY_TOO_LARGE' ? 413 : code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE' ? 415 :
      code === 'FST_ERR_CTP_EMPTY_JSON_BODY' || code === 'FST_ERR_CTP_INVALID_CONTENT_LENGTH' ? 400 : 503;
    return reply.code(status).send(projection(status, request.id, validation ? [field] : []));
  });
  app.setNotFoundHandler((request, reply) => reply.code(404).send(projection(404, request.id)));
  return app;
}
