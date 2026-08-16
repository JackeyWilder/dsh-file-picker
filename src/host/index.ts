import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isLoopbackRequest, readJsonBody } from './http.js'
import { buildInjectSource, buildInjectText, type AttachedFile } from './inject.js'
import { hostLog, PLUGIN_VERSION, redactList } from './log.js'
import { runNativePicker } from './native-pick.js'
import { revealPath } from './reveal.js'

export const name = '@jackeywilder/dsh-file-picker'

export const inject = ['webServer', 'systemPrompt']

/**
 * Model-facing hint: `@path:` draft refs tell the agent to read the file.
 * systemPrompt is a host-only service (dsh-system-prompt mounts it in the host
 * bundle; dsh-ssh/dsh-host-files call ctx.systemPrompt.section() from their
 * host apply). cordis Context in this repo declares neither `webServer` nor
 * `systemPrompt`, so the minimal structural cast below covers only the
 * compile-time gap — at runtime the fiber waits on the injected service.
 */
const PATH_HINT =
  '用户消息中的 `@path: <绝对路径>` 表示要你读取的文件。用 read 工具读取其内容后再继续。'

type SystemPromptFace = {
  section(section: { name: string; order: number; text: string }): () => void
}

/**
 * Minimal structural face for the agent events we listen to. The plugin does
 * not depend on @deepseek-ai/dsh-agent (a host-core package), so the cordis
 * Events merge for `agent/inbox/inserted` is invisible here — this structural
 * cast covers the compile-time gap; at runtime the event dispatches normally
 * (the acp package proves root listeners receive agent-scoped events).
 */
type AgentEventsFace = {
  on(event: 'agent/inbox/inserted', listener: (payload: AgentInboxInsertedPayload) => void): unknown
}

interface AgentInboxInsertedPayload {
  agent: { id: string; inject(message: unknown): void }
  message: { source: { kind: string } }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'referrer-policy': 'no-referrer',
  })
  res.end(payload)
}

/** Parse `files` from a request body into attached-file entries (bare path strings or { path } objects). */
function parseFiles(body: Record<string, unknown> | undefined): AttachedFile[] {
  if (body === undefined) return []
  const entries = Array.isArray(body.files) ? body.files : []
  return entries.filter((entry): entry is AttachedFile =>
    typeof entry === 'string'
    || (typeof entry === 'object' && entry !== null && typeof (entry as { path?: unknown }).path === 'string'))
    .map((entry) => (typeof entry === 'string' ? { path: entry } : entry))
}

export function apply(ctx: Context): void {
  hostLog('host apply: plugin starting')

  ctx.effect(() => (ctx as unknown as { systemPrompt: SystemPromptFace }).systemPrompt.section({
    name: 'dsh-file-picker',
    order: 200,
    text: PATH_HINT,
  }), 'dsh-file-picker: system prompt')

  // Files staged by the browser rail. Keyed by session id; consumed (and
  // cleared) when the next real user message enters that session's inbox —
  // which is the reliable "the user pressed send" signal, independent of how
  // the send was made (typed prompt, slash command, steer, image-only).
  const stagedFiles = new Map<string, AttachedFile[]>()

  // The one injection path: a user message (source.kind 'user') entering the
  // live inbox means the send was accepted. `agent.inject` queues the staged
  // paths as model-facing context for the next pre-step of that same turn, so
  // the context message always rides the message that just went out.
  ;(ctx as unknown as AgentEventsFace).on('agent/inbox/inserted', ({ agent, message }) => {
    hostLog(`inbox/inserted: kind=${message.source.kind} session=${agent.id}`)
    if (message.source.kind !== 'user') return
    const pending = stagedFiles.get(agent.id)
    if (pending === undefined || pending.length === 0) {
      hostLog(`inbox/inserted: nothing staged for session=${agent.id}`)
      return
    }
    stagedFiles.delete(agent.id)
    try {
      agent.inject(createUserMessage({
        source: buildInjectSource(),
        content: [{ type: 'text', text: buildInjectText(pending) }],
      }))
      hostLog(`inbox/inserted: injected ${pending.length} file(s) for session=${agent.id}`)
    } catch (error) {
      hostLog(`inbox/inserted: inject failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-file-picker/native-pick',
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { error: `method not allowed: ${req.method ?? 'GET'}` })
        return
      }
      const body = await readJsonBody(req)
      if (body === undefined) {
        writeJson(res, 400, { error: 'invalid JSON body' })
        return
      }
      const initialDir = typeof body.initialDir === 'string' ? body.initialDir : undefined
      try {
        writeJson(res, 200, await runNativePicker(initialDir))
      } catch (error) {
        writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-file-picker: routes')

  // Stage (or replace) the session's pending attachment list. The rail pushes
  // its current cards here on every change, so the host always mirrors exactly
  // what the user sees — removals included.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-file-picker/stage',
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { error: `method not allowed: ${req.method ?? 'GET'}` })
        return
      }
      const body = await readJsonBody(req)
      const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
      if (sessionId === '') {
        writeJson(res, 400, { error: 'missing sessionId' })
        return
      }
      const files = parseFiles(body)
      if (files.length === 0) {
        stagedFiles.delete(sessionId)
        hostLog(`stage: cleared session=${sessionId}`)
      } else {
        stagedFiles.set(sessionId, files)
        hostLog(`stage: ${files.length} file(s) for session=${sessionId}: ${redactList(files.map((f) => f.path))}`)
      }
      writeJson(res, 200, { ok: true })
    },
  }), 'dsh-file-picker: stage route')

  // Reveal a staged file in Windows Explorer (folder opened, file selected).
  // Loopback fence only — the browser card's "reveal" button calls it.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-file-picker/reveal',
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { error: `method not allowed: ${req.method ?? 'GET'}` })
        return
      }
      const body = await readJsonBody(req)
      const path = typeof body?.path === 'string' && body.path !== '' ? body.path : ''
      if (path === '') {
        writeJson(res, 400, { error: 'missing path' })
        return
      }
      try {
        revealPath(path)
        writeJson(res, 200, { ok: true })
      } catch (error) {
        writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-file-picker: reveal route')

  // Explicitly drop a session's staged list (rail cleared without a send).
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-file-picker/unstage',
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: 'forbidden: loopback-only' })
        return
      }
      if (req.method !== 'POST') {
        writeJson(res, 405, { error: `method not allowed: ${req.method ?? 'GET'}` })
        return
      }
      const body = await readJsonBody(req)
      const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : ''
      if (sessionId === '') {
        writeJson(res, 400, { error: 'missing sessionId' })
        return
      }
      stagedFiles.delete(sessionId)
      hostLog(`unstage: session=${sessionId}`)
      writeJson(res, 200, { ok: true })
    },
  }), 'dsh-file-picker: unstage route')

  // Diagnostic: report the loaded plugin version and the current staging map,
  // so a session export plus this response can localize any pipeline break.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-file-picker/status',
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (!isLoopbackRequest(req)) {
        writeJson(res, 403, { error: 'forbidden: loopback-only' })
        return
      }
      writeJson(res, 200, {
        version: PLUGIN_VERSION,
        staged: [...stagedFiles.entries()].map(([sessionId, files]) => ({
          sessionId,
          files: files.map((f) => f.path),
        })),
      })
    },
  }), 'dsh-file-picker: status route')
}
