import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { FilePickerButton } from './FilePickerButton.js'

export const inject = ['slots', 'systemPrompt']

const PATH_HINT =
  '用户消息中的 `@path: <绝对路径>` 表示要你读取的文件。用 read 工具读取其内容后再继续。'

/**
 * ui-conversation 的 SlotMap 合并未进入本编译单元，`'conversation.input.left'`
 * 不在 `keyof SlotMap`（只见 runtime 声明的 'root'）；`systemPrompt` 也非
 * ClientContext 标准成员。按简报注记用带可选链的降级写法，运行时不改语义。
 */
type LooseSlots = {
  inject(key: string, callback: () => unknown): () => void
  register(options: { name: string; id?: string; order?: number }, component: unknown): () => void
}

export function apply(ctx: ClientContext): void {
  ctx.effect(() => (ctx as { systemPrompt?: { section(o: unknown): void } }).systemPrompt?.section({
    name: 'dsh-file-picker',
    order: 200,
    text: PATH_HINT,
  }), 'dsh-file-picker: system prompt')

  const slots = (ctx as unknown as { slots?: LooseSlots }).slots
  slots?.inject?.('conversation.input.left', () => slots?.register({
    name: 'conversation.input.left',
    id: 'dsh-file-picker',
    order: 5,
  }, FilePickerButton))
}
