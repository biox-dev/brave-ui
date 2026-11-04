import { FC, useCallback, useMemo, useRef } from "react"
import { theme } from "antd"

/** 行高（px），行号栏与编辑区必须保持一致，否则会错行。 */
const LINE_HEIGHT = 20
/** 字号（px）。 */
const FONT_SIZE = 13
/** 垂直内边距（px），同样需要行号栏与编辑区一致。 */
const PADDING_Y = 8
/** Tab 插入的空格数。 */
const TAB_SIZE = 4

type LightweightEditorProps = {
    /** 编辑器内容（受控）。 */
    value: string
    /** 编辑器高度（px）。 */
    height: number
    /** 内容变化回调。 */
    onChange?: (value: string) => void
    /** 只读模式。 */
    readOnly?: boolean
}

/**
 * 轻量代码编辑器：纯 textarea + 行号栏，零第三方依赖、不需要下载 Monaco 与 Worker。
 * 打开即有内容，适合内网、弱网环境或较大文件快速查看/修改；Tab 键插入 4 个空格。
 */
const LightweightEditor: FC<LightweightEditorProps> = ({ value, height, onChange, readOnly = false }) => {
    const { token } = theme.useToken()
    const gutterRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // 行号只和行数有关，避免每次按键都整段重新 split 拼接。
    const lineCount = useMemo(() => (value.length === 0 ? 1 : value.split("\n").length), [value])
    const lineNumbers = useMemo(() => {
        const lines: string[] = []
        for (let index = 1; index <= lineCount; index += 1) {
            lines.push(String(index))
        }
        return lines.join("\n")
    }, [lineCount])

    /** 行号栏跟随编辑区纵向滚动。 */
    const handleScroll = useCallback(() => {
        if (gutterRef.current && textareaRef.current) {
            gutterRef.current.scrollTop = textareaRef.current.scrollTop
        }
    }, [])

    /** Tab 插入空格而不是切换焦点。 */
    const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Tab" || readOnly) return
        event.preventDefault()
        const el = event.currentTarget
        const start = el.selectionStart
        const end = el.selectionEnd
        const padding = " ".repeat(TAB_SIZE)
        onChange?.(`${value.slice(0, start)}${padding}${value.slice(end)}`)
        // 受控值回填后再恢复光标，避免光标跳到末尾。
        requestAnimationFrame(() => {
            const next = textareaRef.current
            if (!next) return
            next.selectionStart = start + TAB_SIZE
            next.selectionEnd = start + TAB_SIZE
        })
    }, [onChange, readOnly, value])

    const sharedFont: React.CSSProperties = {
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
        fontSize: FONT_SIZE,
        lineHeight: `${LINE_HEIGHT}px`,
        letterSpacing: 0,
    }

    return (
        <div style={{ display: "flex", height, background: token.colorBgContainer }}>
            <div
                ref={gutterRef}
                aria-hidden
                style={{
                    ...sharedFont,
                    flex: "0 0 auto",
                    minWidth: 48,
                    padding: `${PADDING_Y}px 8px`,
                    textAlign: "right",
                    whiteSpace: "pre",
                    overflow: "hidden",
                    color: token.colorTextQuaternary,
                    background: token.colorFillQuaternary,
                    borderRight: `1px solid ${token.colorBorderSecondary}`,
                    userSelect: "none",
                }}
            >
                {lineNumbers}
            </div>
            <textarea
                ref={textareaRef}
                value={value}
                readOnly={readOnly}
                spellCheck={false}
                wrap="off"
                onChange={(event) => onChange?.(event.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                style={{
                    ...sharedFont,
                    flex: 1,
                    minWidth: 0,
                    height,
                    padding: `${PADDING_Y}px 12px`,
                    border: "none",
                    outline: "none",
                    resize: "none",
                    background: "transparent",
                    color: token.colorText,
                    overflow: "auto",
                    tabSize: TAB_SIZE,
                    whiteSpace: "pre",
                }}
            />
        </div>
    )
}

export default LightweightEditor
