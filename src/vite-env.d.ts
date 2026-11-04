/// <reference types="vite/client" />

// monaco-editor 的 ESM 精简入口没有自带类型声明：
// edcore.main 负责注册编辑器全部内置特性，运行时导出的 API 与 editor.api 一致。
declare module "monaco-editor/esm/vs/editor/edcore.main" {
    export * from "monaco-editor/esm/vs/editor/editor.api";
}
