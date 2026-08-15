import { defineConfig } from 'tsdown'

export default defineConfig([
  // 宿主侧：普通 ESM
  {
    entry: { index: 'src/host/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    clean: false,
    // package.json type: module，固定输出 lib/index.js（否则 tsdown 默认产出 .mjs，
    // 与 package.json 的 main/exports 指向 lib/index.js 不符）
    fixedExtension: false,
  },
  // 浏览器侧：CJS 闭包产物，__ModuleLoader__.load 包裹
  {
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: ['cjs'],
    clean: false,
    external: [
      'react',
      'react/jsx-runtime',
      'react-dom',
      'react-dom/client',
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-client-web-react',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-attachment',
      '@deepseek-ai/dsh-client-schema-form',
    ],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: "dsh-file-picker", factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
