// Monaco 的本地轻量装配（必须在任何 <Editor> 渲染前执行）。
//
// 之前把 `loader.config({ monaco })` 放在组件的 useEffect 里，而 @monaco-editor/react 的
// <Editor> 在自己的 effect 中就会调用 loader.init()。子组件 effect 先于父组件执行，于是
// init() 看到还没有本地 monaco，就会往页面注入
// `https://cdn.jsdelivr.net/npm/monaco-editor@<版本>/min/vs/loader.js` 并等待它加载。
// 内网 / 离线 / CDN 被墙时该脚本永远不返回，编辑器就永远停在 “Loading...”。
//
// 这里改为在模块加载阶段完成配置，并且只引入编辑器核心（edcore）+ 实际用到的语言，
// 不再整包引入 monaco-editor（可显著减小 chunk 体积与首屏等待）。
import "monaco-editor/esm/vs/editor/edcore.main";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import { loader } from "@monaco-editor/react";

import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

// 语言服务：只保留 JSON（其余语言用 basic-languages 的高亮即可）。
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution";
import "monaco-editor/esm/vs/basic-languages/shell/shell.contribution";
import "monaco-editor/esm/vs/basic-languages/r/r.contribution";
import "monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution";
import "monaco-editor/esm/vs/basic-languages/sql/sql.contribution";

// Worker 由 Vite 打包成本地资源，不走 CDN。
(self as any).MonacoEnvironment = {
    getWorker(_workerId: string, label: string) {
        if (label === "json") {
            return new jsonWorker();
        }
        return new editorWorker();
    },
};

// 关键：绑定本地实例，loader.init() 会直接 resolve，不再注入 CDN 脚本。
loader.config({ monaco });

export { monaco };
