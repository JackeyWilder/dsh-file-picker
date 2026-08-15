import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { FilePickerButton } from './FilePickerButton.js'

export const inject = ['slots']

/**
 * ui-conversation 的 SlotMap 合并未进入本编译单元，`'conversation.input.left'`
 * 不在 `keyof SlotMap`（只见 runtime 声明的 'root'）。按简报注记用带可选链的
 * 降级写法，运行时不改语义。systemPrompt 注入已移至宿主侧（host apply）。
 */
type LooseSlots = {
  inject(key: string, callback: () => unknown): () => void
  register(options: { name: string; id?: string; order?: number }, component: unknown): () => void
}

export function apply(ctx: ClientContext): void {
  const slots = (ctx as unknown as { slots?: LooseSlots }).slots
  slots?.inject?.('conversation.input.left', () => slots?.register({
    name: 'conversation.input.left',
    id: 'dsh-file-picker',
    order: 5,
  }, FilePickerButton))
}
