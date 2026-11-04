// yarn add @monaco-editor/react
// yarn add monaco-editor

import { type FC } from 'react'
import Editor from '@monaco-editor/react';
import { useSelector } from 'react-redux';
// 必须排在最前：在任何 <Editor> 渲染之前把本地打包的 Monaco 绑定到 loader。
// 之前这些配置放在 useEffect 里，子组件 <Editor> 的 effect 先执行并触发了 loader.init()，
// 于是 loader 往页面注入 CDN 脚本（https://cdn.jsdelivr.net/npm/monaco-editor/.../loader.js），
// 内网 / 离线 / CDN 不可达时编辑器会一直停在 “Loading...”。
import './monaco-setup';

const MonacoEditorComp: FC<any> = ({
    onChange,
    value,
    editorRef,
    defaultLanguage,
    language,
    format,
    height,
    options,
    path,
    onEditorMount,
}) => {
    const { theme } = useSelector((state: any) => state.user);

    function handleEditorDidMount(editor: any, monaco: any) {
        if (editorRef) {
            editorRef.current = editor;
            if (format) {
                editor.onDidChangeModelDecorations(async () => {
                    await editorRef.current?.getAction('editor.action.formatDocument')?.run();
                });
            }
        }
        onEditorMount?.(editor, monaco);
    }

    return <Editor
        height={height ? height : "65vh"}
        value={value}
        // path 让不同脚本各自拥有独立的 model（撤销栈、滚动位置互不干扰）。
        path={path}
        language={language || defaultLanguage}
        theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
        onChange={onChange}
        loading={<div style={{ padding: 16, color: '#999' }}>Loading editor…</div>}
        onMount={handleEditorDidMount}
        options={{
            wordWrap: 'on',
            formatOnPaste: true,
            ...options,
        }}
    />
}

export default MonacoEditorComp




