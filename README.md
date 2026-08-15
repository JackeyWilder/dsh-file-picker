# dsh-file-picker

为 dsh web 添加"选择工作区外文件"入口：输入框工具行按钮 → 文件浏览对话框（任意目录、多选）→ 以 `@path:` 标记注入消息草稿，agent 用 read 工具读取。

## 安装

```bash
dsh plugin --profile web add link:"<本包路径>"
```

## 使用

1. 点击输入框工具行的 📎 按钮；
2. 浏览并多选文件（目录双击进入，路径框可粘贴完整路径）；
3. 点"打开"——草稿追加 `@path: <绝对路径>` 行；
4. 发送，agent 会用 read 读取这些文件。

## 开发

```bash
pnpm install && pnpm build
npx vitest run
```

## 安全

宿主侧路由仅接受 loopback 请求（`isLoopbackRequest` 校验 remoteAddress/Host/sec-fetch-site/Origin）；只提供只读列目录能力，不读文件内容、不写文件。
