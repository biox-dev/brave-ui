import { CloseOutlined } from "@ant-design/icons"
import { Button } from "antd"
import { FC, type CSSProperties, type ReactNode } from "react"
import "./panel-layout.css"

/**
 * 统一的页面 / 面板骨架：固定高度标题栏（含 title 下分割线）+ 可滚动内容区。
 *
 * 所有路由页面（脚本 / 工作流 / 分析报告 / 分析节点详情）与参数面板都使用它，
 * 不再各自用 antd Card 拼标题栏，好处：
 * - 标题栏高度固定为 44px，不随标题长度、按钮数量、内容多少变化，切页时不跳动；
 * - 标题栏不参与滚动（只有 body 独立滚动），长页面滚动时标题始终可见；
 * - 页面自身不画卡片边框，上下左右的分割统一由布局线条提供，
 *   只保留标题栏底部这一条分割线。
 *
 *   <PanelLayout title={<span>Name</span>} extra={<Button />} onClose={...}>
 *       ...内容...
 *   </PanelLayout>
 */
export type PanelLayoutProps = {
  /** 标题内容（可放图标、名称、标签等）。 */
  title?: ReactNode
  /** 标题栏右侧操作区（按钮、Segmented 等）。 */
  extra?: ReactNode
  /** 传入后在标题栏右侧显示关闭按钮。 */
  onClose?: () => void
  closeLabel?: string
  className?: string
  bodyClassName?: string
  bodyStyle?: CSSProperties
  style?: CSSProperties
  children?: ReactNode
}

export const PanelLayout: FC<PanelLayoutProps> = ({
  title,
  extra,
  onClose,
  closeLabel = "Close panel",
  className,
  bodyClassName,
  bodyStyle,
  style,
  children,
}) => (
  <section className={`panel-layout${className ? ` ${className}` : ""}`} style={style}>
    <header className="panel-layout-head">
      <div className="panel-layout-title">{title}</div>
      <div className="panel-layout-actions">
        {extra}
        {onClose ? (
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            aria-label={closeLabel}
            onClick={onClose}
          />
        ) : null}
      </div>
    </header>
    <div
      className={`panel-layout-body${bodyClassName ? ` ${bodyClassName}` : ""}`}
      style={bodyStyle}
    >
      {children}
    </div>
  </section>
)

export default PanelLayout
