import { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isLoopbackRequest, readJsonBody } from './http.js'
import { buildInjectSource, buildInjectText } from './inject.js'
import { runNativePicker } from './native-pick.js'

export const name = '@jackeywilder/dsh-file-picker'

export const inject = ['webServer', 'systemPrompt', 'agents']

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

/** Minimal structural face for the host `agents` service (dsh-agent registry). */
type AgentsFace = {
  get(id: string): { inject(message: unknown): void } | undefined
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'referrer-policy': 'no-referrer',
  })
  res.end(payload)
}

export function apply(ctx: Context): void {
  ctx.effect(() => (ctx as unknown as { systemPrompt: SystemPromptFace }).systemPrompt.section({
    name: 'dsh-file-picker',
    order: 200,
    text: PATH_HINT,
  }), 'dsh-file-picker: system prompt')

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

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-file-picker/inject',
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
      const sessionId = typeof body.sessionId === 'string' ? body.sessionId : ''
      if (sessionId === '') {
        writeJson(res, 400, { error: 'missing sessionId' })
        return
      }
      // Accept either bare absolute paths (strings) or { path, name?, size? } entries.
      const files = Array.isArray(body.files)
        ? body.files.filter((entry): entry is string | { path: string } =>
            typeof entry === 'string' || (typeof entry === 'object' && entry !== null && typeof entry.path === 'string'))
        : []
      if (files.length === 0) {
        writeJson(res, 400, { error: 'no files' })
        return
      }
      try {
        const agents = (ctx as { get(name: string): unknown }).get('agents') as AgentsFace | undefined
        const agent = agents?.get(sessionId)
        if (!agent) {
          writeJson(res, 500, { error: `agent not found for session: ${sessionId}` })
          return
        }
        agent.inject(createUserMessage({
          source: buildInjectSource(),
          content: [{ type: 'text', text: buildInjectText(files) }],
        }))
        writeJson(res, 200, { ok: true })
      } catch (error) {
        writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      }
    },
  }), 'dsh-file-picker: inject route')
}
