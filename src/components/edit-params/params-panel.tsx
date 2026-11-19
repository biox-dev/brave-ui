import { Skeleton } from "antd"
import { FC, lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react"
import PanelLayout from "@/components/common/panel-layout"
import type { EditParamsTarget } from "./use-edit-params-target"
import "./params-panel.css"

const EditParamsPanel = lazy(() => import("./components/edit-params"))

export type ParamsPanelSide = "left" | "right"

/**
 * 页面级参数面板布局：内容区 + 一侧停靠的参数面板。
 *
 * 面板不抢占主内容、不做全局状态，页面传什么 target 就编辑什么：
 *
 *   <ParamsPanelLayout
 *       open={open}
 *       side="right"
 *       panel={<ParamsPanelDock onClose={() => setOpen(false)}><ParamsEdit target={target} /></ParamsPanelDock>}
 *   >
 *       ...页面内容
 *   </ParamsPanelLayout>
 */
export const ParamsPanelLayout: FC<{
    open?: boolean
    side?: ParamsPanelSide
    panel: ReactNode
    children: ReactNode
}> = ({ open = true, side = "right", panel, children }) => (
    <div className={`params-panel-layout is-${side}${open ? " is-open" : ""}`}>
        {open && side === "left" ? panel : null}
        <div className="params-panel-layout-main">{children}</div>
        {open && side === "right" ? panel : null}
    </div>
)

export type ParamsPanelDockProps = {
    side?: ParamsPanelSide
    title?: ReactNode
    /** 标题栏右侧的额外操作（刷新、选择目标等）。 */
    extra?: ReactNode
    onClose?: () => void
    children?: ReactNode
    defaultWidth?: number
    minWidth?: number
    maxWidth?: number
    /** 面板宽度持久化 key；不同页面可各自记住自己的宽度。 */
    storageKey?: string
}

/**
 * 停靠式参数面板外壳：标题栏 + 可滚动内容 + 宽度拖拽。
 * 负责「怎么显示」，不关心「编辑什么」，内容由调用方传入。
 */
export const ParamsPanelDock: FC<ParamsPanelDockProps> = ({
    side = "right",
    title = "Parameters",
    extra,
    onClose,
    children,
    defaultWidth = 420,
    minWidth = 320,
    maxWidth = 760,
    storageKey,
}) => {
    const storage = storageKey ?? `paramsPanelWidth:${side}`
    const [width, setWidth] = useState<number>(() => {
        const saved = Number(localStorage.getItem(storage))
        return Number.isFinite(saved) && saved >= minWidth && saved <= maxWidth ? saved : defaultWidth
    })
    const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)
    const widthRef = useRef(width)

    useEffect(() => {
        widthRef.current = width
    }, [width])

    // 拖拽结束（或组件卸载）时统一清理 window 监听，避免残留监听器。
    useEffect(() => {
        return () => {
            dragRef.current = null
            document.body.classList.remove("params-panel-resizing")
        }
    }, [])

    const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
        event.preventDefault()
        dragRef.current = { startX: event.clientX, startWidth: width }
        document.body.classList.add("params-panel-resizing")

        const onPointerMove = (moveEvent: PointerEvent) => {
            const drag = dragRef.current
            if (!drag) {
                return
            }
            const delta = side === "right" ? drag.startX - moveEvent.clientX : moveEvent.clientX - drag.startX
            const next = Math.min(maxWidth, Math.max(minWidth, drag.startWidth + delta))
            setWidth(next)
        }
        const onPointerUp = () => {
            dragRef.current = null
            // 拖拽过程中每帧写 localStorage 会有明显卡顿，拖动结束再持久化一次。
            localStorage.setItem(storage, String(widthRef.current))
            document.body.classList.remove("params-panel-resizing")
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("pointerup", onPointerUp)
        }
        window.addEventListener("pointermove", onPointerMove)
        window.addEventListener("pointerup", onPointerUp)
    }

    const style: CSSProperties = { width }

    return (
        <aside className={`params-panel-dock is-${side}`} style={style}>
            <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize parameters panel"
                className="params-panel-dock-resizer"
                onPointerDown={handleResizeStart}
            />
            {/* 标题栏与路由页面共用同一个骨架：高度、分割线、标题样式完全一致。 */}
            <PanelLayout
                title={title}
                extra={extra}
                onClose={onClose}
                closeLabel="Close parameters panel"
                bodyClassName="params-panel-dock-body"
            >
                {children}
            </PanelLayout>
        </aside>
    )
}

/**
 * 参数编辑面板（懒加载 `edit-params`）。
 * 页面只需要给出 target，面板自己拉取 / 刷新 / 保存。
 */
export const ParamsEdit: FC<{ target?: EditParamsTarget | null; onClose?: () => void; onSaved?: () => void }> = ({
    target,
    onClose,
    onSaved,
}) => (
    <Suspense fallback={<Skeleton active />}>
        <EditParamsPanel target={target} onClose={onClose} onSaved={onSaved} />
    </Suspense>
)
