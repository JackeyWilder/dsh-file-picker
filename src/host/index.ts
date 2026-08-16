import { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isLoopbackRequest, readJsonBody } from './http.js'
import { runNativePicker } from './native-pick.js'

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
}
