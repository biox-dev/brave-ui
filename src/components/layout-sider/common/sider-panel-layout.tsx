import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import type { ReactNode } from 'react';
import './sider-panel-layout.css';

export interface SiderPanelLayoutProps {
  /** 面板标题。 */
  title: ReactNode;
  /** 标题右侧的额外信息（例如文件数徽标）。 */
  titleExtra?: ReactNode;
  /** 标题栏右侧的动作按钮。 */
  actions?: ReactNode;
  /** 折叠态：折叠时仅保留标题栏。 */
  collapsed?: boolean;
  /** 点击标题栏时切换折叠态（未传入则标题栏不可点击）。 */
  onToggleCollapse?: () => void;
  /** 操作区下方的附加区域（例如视图切换）。 */
  subHeader?: ReactNode;
  /** 面板底部的操作区（选择器的 Cancel / Confirm 等）。 */
  footer?: ReactNode;
  /** 面板主体。 */
  children?: ReactNode;
  /** 追加到根节点的类名（用于保留页面既有样式钩子）。 */
  className?: string;
  /** 追加到主体容器的类名。 */
  bodyClassName?: string;
  /** 标题栏的类名。 */
  headerClassName?: string;
}

/**
 * 左侧栏面板统一布局。
 *
 * 所有 `leftActivityItems` 对应的页面（脚本、流程、分析、项目报告、参考文献、
 * 容器模板、应用会话、智能体会话、项目文件等）都使用同一套骨架：
 *
 * - 标题栏：折叠箭头 + 标题 + 可选计数 + 右侧动作按钮；
 * - 可选副标题区域（视图切换等）；
 * - 主体区域；
 * - 可选底部操作区（选择器模式）。
 *
 * 折叠时主体 / 副标题 / 底部区域只做 `display:none`，保留 DOM 与内部状态，
 * 与页面原先的折叠实现保持一致。
 */
const SiderPanelLayout = ({
  title,
  titleExtra,
  actions,
  collapsed = false,
  onToggleCollapse,
  subHeader,
  footer,
  children,
  className,
  bodyClassName,
  headerClassName,
}: SiderPanelLayoutProps) => (
  <div
    className={`project-report-panel${collapsed ? ' is-collapsed' : ''}${
      className ? ` ${className}` : ''
    }`}
  >
    <div
      className={`project-report-panel-header${headerClassName ? ` ${headerClassName}` : ''}`}
    >
      <div className="sider-panel-heading">
        {onToggleCollapse ? (
          <button
            type="button"
            className="project-report-panel-title project-report-panel-title-button"
            aria-expanded={!collapsed}
            onClick={onToggleCollapse}
          >
            {collapsed ? (
              <CaretRightOutlined className="project-report-panel-chevron" />
            ) : (
              <CaretDownOutlined className="project-report-panel-chevron" />
            )}
            <span>{title}</span>
          </button>
        ) : (
          <span className="project-report-panel-title">{title}</span>
        )}
        {titleExtra}
      </div>
      {actions ? <div className="project-report-panel-actions">{actions}</div> : null}
    </div>

    {subHeader ? (
      <div
        className="sider-panel-subheader"
        style={collapsed ? { display: 'none' } : undefined}
      >
        {subHeader}
      </div>
    ) : null}

    <div
      className={`project-report-panel-body${bodyClassName ? ` ${bodyClassName}` : ''}`}
      style={collapsed ? { display: 'none' } : undefined}
    >
      {children}
    </div>

    {footer ? (
      <div className="sider-panel-footer" style={collapsed ? { display: 'none' } : undefined}>
        {footer}
      </div>
    ) : null}
  </div>
);

export default SiderPanelLayout;
