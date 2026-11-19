import React, { useEffect, useRef, useState } from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

type SplitWorkspaceProps = {
  left?: React.ReactNode;
  main?: React.ReactNode;
  /** 中间面板（如 Assistant）：渲染在 left 与 main 之间 */
  assistant?: React.ReactNode;
  right?: React.ReactNode;
  /** 右侧中间面板（如标签页）：渲染在 main 与 right 之间 */
  rightMiddle?: React.ReactNode;
  /** 顶部通栏 header：横跨所有面板，渲染在工作区最上方（不参与面板宽度拖拽）。 */
  header?: React.ReactNode;
  /** 主区域无内容时，让右侧面板拉伸占满剩余空间 */
  expandRight?: boolean;
  /** 左侧面板是否折叠隐藏（受控）；不传时组件内部维护 */
  leftCollapsed?: boolean;
  onLeftCollapsedChange?: (collapsed: boolean) => void;
  /** 是否显示左侧面板折叠按钮 */
  showLeftToggle?: boolean;
  leftCollapseLabel?: string;
  leftExpandLabel?: string;
  /** 右侧面板是否折叠隐藏（受控）；不传时组件内部维护 */
  rightCollapsed?: boolean;
  onRightCollapsedChange?: (collapsed: boolean) => void;
  /** 是否显示右侧面板折叠按钮 */
  showRightToggle?: boolean;
  rightCollapseLabel?: string;
  rightExpandLabel?: string;
  leftWidth?: number;
  assistantWidth?: number;
  rightMiddleWidth?: number;
  rightWidth?: number;
  onLeftWidthChange?: (width: number) => void;
  onAssistantWidthChange?: (width: number) => void;
  onRightMiddleWidthChange?: (width: number) => void;
  onRightWidthChange?: (width: number) => void;
  onLeftWidthCommit?: (width: number) => void;
  onAssistantWidthCommit?: (width: number) => void;
  onRightMiddleWidthCommit?: (width: number) => void;
  onRightWidthCommit?: (width: number) => void;
  leftResizeLabel?: string;
  assistantResizeLabel?: string;
  rightMiddleResizeLabel?: string;
  rightResizeLabel?: string;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  defaultLeftWidth?: number;
  minAssistantWidth?: number;
  maxAssistantWidth?: number;
  defaultAssistantWidth?: number;
  minRightMiddleWidth?: number;
  maxRightMiddleWidth?: number;
  defaultRightMiddleWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  defaultRightWidth?: number;
  /** 拖动右侧分隔条时，主区域（如 agentChat）至少保留的宽度（px）。 */
  minMainWidth?: number;
};

type DividerKey = 'left' | 'assistant' | 'rightMiddle' | 'right';

type PanePlan = { key: DividerKey; width: number; min: number };

// 工作台布局不做响应式堆叠：窗口变窄时先把侧边面板等比压缩（各面板不低于自身 min），
// 连 min 都放不下时才按 min 比例继续压缩，把剩余宽度留给主区域（主区域不再被挤成 0 或换行）。
const fitPaneWidths = (panes: PanePlan[], budget: number): number[] => {
  const desiredTotal = panes.reduce((sum, pane) => sum + pane.width, 0);
  if (!Number.isFinite(budget) || desiredTotal <= budget) {
    return panes.map((pane) => pane.width);
  }
  const minTotal = panes.reduce((sum, pane) => sum + pane.min, 0);
  if (minTotal <= 0) {
    return panes.map(() => 0);
  }
  if (budget <= minTotal) {
    return panes.map((pane) => (pane.min * budget) / minTotal);
  }
  const scale = (budget - minTotal) / (desiredTotal - minTotal);
  return panes.map((pane) => pane.min + (pane.width - pane.min) * scale);
};

const SplitWorkspace: React.FC<SplitWorkspaceProps> = ({
  left,
  main,
  assistant,
  rightMiddle,
  right,
  header,
  expandRight = false,
  leftCollapsed,
  onLeftCollapsedChange,
  showLeftToggle = true,
  leftCollapseLabel = 'Hide left panel',
  leftExpandLabel = 'Show left panel',
  rightCollapsed,
  onRightCollapsedChange,
  showRightToggle = true,
  rightCollapseLabel = 'Hide right panel',
  rightExpandLabel = 'Show right panel',
  leftWidth,
  assistantWidth,
  rightMiddleWidth,
  rightWidth,
  onLeftWidthChange,
  onAssistantWidthChange,
  onRightMiddleWidthChange,
  onRightWidthChange,
  onLeftWidthCommit,
  onAssistantWidthCommit,
  onRightMiddleWidthCommit,
  onRightWidthCommit,
  leftResizeLabel = 'Resize left panel',
  assistantResizeLabel = 'Resize assistant panel',
  rightMiddleResizeLabel = 'Resize right middle panel',
  rightResizeLabel = 'Resize right panel',
  minLeftWidth = 240,
  maxLeftWidth = 560,
  defaultLeftWidth = 320,
  minAssistantWidth = 240,
  maxAssistantWidth = 560,
  defaultAssistantWidth = 320,
  minRightMiddleWidth = 280,
  maxRightMiddleWidth = 960,
  defaultRightMiddleWidth = 480,
  minRightWidth = 280,
  maxRightWidth = 640,
  defaultRightWidth = 360,
  minMainWidth = 320,
}) => {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const assistantPaneRef = useRef<HTMLDivElement | null>(null);
  const rightMiddlePaneRef = useRef<HTMLDivElement | null>(null);
  const leftWidthRef = useRef(defaultLeftWidth);
  const assistantWidthRef = useRef(defaultAssistantWidth);
  const rightMiddleWidthRef = useRef(defaultRightMiddleWidth);
  const rightWidthRef = useRef(defaultRightWidth);
  const leftWidthPropRef = useRef<number | undefined>(leftWidth);
  const assistantWidthPropRef = useRef<number | undefined>(assistantWidth);
  const rightMiddleWidthPropRef = useRef<number | undefined>(rightMiddleWidth);
  const rightWidthPropRef = useRef<number | undefined>(rightWidth);
  const [activeDivider, setActiveDivider] = useState<DividerKey | null>(null);
  const [innerLeftWidth, setInnerLeftWidth] = useState(defaultLeftWidth);
  const [innerAssistantWidth, setInnerAssistantWidth] = useState(defaultAssistantWidth);
  const [innerRightMiddleWidth, setInnerRightMiddleWidth] = useState(defaultRightMiddleWidth);
  const [innerRightWidth, setInnerRightWidth] = useState(defaultRightWidth);
  const [innerLeftCollapsed, setInnerLeftCollapsed] = useState(false);
  const [innerRightCollapsed, setInnerRightCollapsed] = useState(false);
  // 容器实测宽度：窗口变窄时据此重新分配各面板宽度，保证主区域不被挤没
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const hasLeftPane = Boolean(left);
  const hasMainPane = Boolean(main);
  const hasAssistantPane = Boolean(assistant);
  const hasRightMiddlePane = Boolean(rightMiddle);
  const hasRightPane = Boolean(right);
  const isLeftCollapsed = Boolean(leftCollapsed ?? innerLeftCollapsed);
  const isRightCollapsed = Boolean(rightCollapsed ?? innerRightCollapsed);
  // 主区域没有内容时，由最靠近主区域的面板撑满剩余空间：有中间面板时是中间面板，否则是右侧面板
  const isRightExpanded = expandRight && !hasMainPane && hasRightPane && !hasAssistantPane;
  const isAssistantExpanded = expandRight && !hasMainPane && hasAssistantPane;

  // 面板宽度分两步：先按用户设定值（受 min/max 约束）算出「期望宽度」，窗口变宽后能原样恢复；
  // 再按容器实测宽度统一分配：工作台在任何窗口宽度下都保持横向排列，空间不足时先等比压缩
  // 侧边面板（各面板不低于自身 min），把剩余宽度留给主区域，而不是把面板改成上下堆叠。
  const configuredLeftWidth = Math.min(
    maxLeftWidth,
    Math.max(minLeftWidth, leftWidth ?? innerLeftWidth),
  );
  const configuredAssistantWidth = Math.min(
    maxAssistantWidth,
    Math.max(minAssistantWidth, assistantWidth ?? innerAssistantWidth),
  );
  const configuredRightMiddleWidth = Math.min(
    maxRightMiddleWidth,
    Math.max(minRightMiddleWidth, rightMiddleWidth ?? innerRightMiddleWidth),
  );
  const configuredRightWidth = Math.min(
    maxRightWidth,
    Math.max(minRightWidth, rightWidth ?? innerRightWidth),
  );
  const panePlans: PanePlan[] = [];
  if (hasLeftPane && !isLeftCollapsed) {
    panePlans.push({ key: 'left', width: configuredLeftWidth, min: minLeftWidth });
  }
  // 撑满剩余空间的面板（expandRight）宽度由 flex 决定，不参与空间分配，避免白占预算。
  if (hasAssistantPane && !isAssistantExpanded) {
    panePlans.push({
      key: 'assistant',
      width: configuredAssistantWidth,
      min: minAssistantWidth,
    });
  }
  if (hasRightMiddlePane) {
    panePlans.push({
      key: 'rightMiddle',
      width: configuredRightMiddleWidth,
      min: minRightMiddleWidth,
    });
  }
  if (hasRightPane && !isRightCollapsed && !isRightExpanded) {
    panePlans.push({ key: 'right', width: configuredRightWidth, min: minRightWidth });
  }
  // 容器未测量时（首帧）沿用期望宽度；测量后先把「主区域最小宽度」从预算里扣掉，
  // 再交给 fitPaneWidths 分配。
  const paneWidthBudget =
    workspaceWidth > 0
      ? Math.max(0, workspaceWidth - (hasMainPane ? minMainWidth : 0))
      : Number.POSITIVE_INFINITY;
  const fittedPaneWidths = fitPaneWidths(panePlans, paneWidthBudget);
  const paneWidths: Record<DividerKey, number> = {
    left: 0,
    assistant: 0,
    rightMiddle: 0,
    right: 0,
  };
  panePlans.forEach((pane, index) => {
    paneWidths[pane.key] = fittedPaneWidths[index];
  });
  const currentLeftWidth = paneWidths.left;
  const currentAssistantWidth = paneWidths.assistant;
  const currentRightMiddleWidth = paneWidths.rightMiddle;
  const currentRightWidth = paneWidths.right;

  const applyLeftWidth = (width: number) => {
    if (leftWidthRef.current === width) {
      return;
    }
    leftWidthRef.current = width;
    if (leftWidthPropRef.current === undefined) {
      setInnerLeftWidth(width);
    }
    onLeftWidthChange?.(width);
  };

  const applyAssistantWidth = (width: number) => {
    if (assistantWidthRef.current === width) {
      return;
    }
    assistantWidthRef.current = width;
    if (assistantWidthPropRef.current === undefined) {
      setInnerAssistantWidth(width);
    }
    onAssistantWidthChange?.(width);
  };

  const applyRightMiddleWidth = (width: number) => {
    if (rightMiddleWidthRef.current === width) {
      return;
    }
    rightMiddleWidthRef.current = width;
    if (rightMiddleWidthPropRef.current === undefined) {
      setInnerRightMiddleWidth(width);
    }
    onRightMiddleWidthChange?.(width);
  };

  const applyRightWidth = (width: number) => {
    if (rightWidthRef.current === width) {
      return;
    }
    rightWidthRef.current = width;
    if (rightWidthPropRef.current === undefined) {
      setInnerRightWidth(width);
    }
    onRightWidthChange?.(width);
  };

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) {
      return;
    }
    const syncWidth = () => setWorkspaceWidth(element.getBoundingClientRect().width);
    syncWidth();
    const observer = new ResizeObserver(syncWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    leftWidthPropRef.current = leftWidth;
  }, [leftWidth]);

  useEffect(() => {
    assistantWidthPropRef.current = assistantWidth;
  }, [assistantWidth]);

  useEffect(() => {
    rightMiddleWidthPropRef.current = rightMiddleWidth;
  }, [rightMiddleWidth]);

  useEffect(() => {
    rightWidthPropRef.current = rightWidth;
  }, [rightWidth]);

  // ref 同步的是「用户期望宽度」而不是压缩后的显示宽度：拖拽 / 其他分隔条的可用空间
  // 都按用户意图计算，窗口恢复宽度时布局能还原，不会把压缩结果写回状态。
  useEffect(() => {
    leftWidthRef.current = configuredLeftWidth;
  }, [configuredLeftWidth]);

  useEffect(() => {
    assistantWidthRef.current = configuredAssistantWidth;
  }, [configuredAssistantWidth]);

  useEffect(() => {
    rightMiddleWidthRef.current = configuredRightMiddleWidth;
  }, [configuredRightMiddleWidth]);

  useEffect(() => {
    rightWidthRef.current = configuredRightWidth;
  }, [configuredRightWidth]);

  useEffect(() => {
    if (leftWidth !== undefined) {
      return;
    }
    setInnerLeftWidth((prev) => Math.min(maxLeftWidth, Math.max(minLeftWidth, prev)));
  }, [leftWidth, minLeftWidth, maxLeftWidth]);

  useEffect(() => {
    if (assistantWidth !== undefined) {
      return;
    }
    setInnerAssistantWidth((prev) =>
      Math.min(maxAssistantWidth, Math.max(minAssistantWidth, prev)),
    );
  }, [assistantWidth, minAssistantWidth, maxAssistantWidth]);

  useEffect(() => {
    if (rightMiddleWidth !== undefined) {
      return;
    }
    setInnerRightMiddleWidth((prev) =>
      Math.min(maxRightMiddleWidth, Math.max(minRightMiddleWidth, prev)),
    );
  }, [rightMiddleWidth, minRightMiddleWidth, maxRightMiddleWidth]);

  useEffect(() => {
    if (rightWidth !== undefined) {
      return;
    }
    setInnerRightWidth((prev) => Math.min(maxRightWidth, Math.max(minRightWidth, prev)));
  }, [rightWidth, minRightWidth, maxRightWidth]);

  useEffect(() => {
    if (!activeDivider) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!workspaceRef.current) {
        return;
      }
      const rect = workspaceRef.current.getBoundingClientRect();
      if (activeDivider === 'left' && hasLeftPane) {
        const nextWidth = event.clientX - rect.left;
        const clampedWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, nextWidth));
        applyLeftWidth(clampedWidth);
      }
      if (activeDivider === 'assistant' && hasAssistantPane) {
        // 中间面板在主区域左侧：它的左边界不会随拖拽移动（右侧的 main 是 flex 吸剩空间），
        // 所以直接用它的左边界算宽度。
        const assistantLeft = assistantPaneRef.current
          ? assistantPaneRef.current.getBoundingClientRect().left
          : rect.left;
        const nextWidth = event.clientX - assistantLeft;
        const clampedWidth = Math.min(
          maxAssistantWidth,
          Math.max(minAssistantWidth, nextWidth),
        );
        applyAssistantWidth(clampedWidth);
      }
      if (activeDivider === 'rightMiddle' && hasRightMiddlePane) {
        // 右侧中间面板的右边界由右侧面板固定：拖拽时宽度 = 右边界 - 指针位置。
        // 同时给主区域保留最小宽度（左侧 / 中间 / 右侧中间面板固定在分隔条左边）。
        const rightMiddleRight = rightMiddlePaneRef.current
          ? rightMiddlePaneRef.current.getBoundingClientRect().right
          : rect.right;
        const leftSpace = hasLeftPane && !isLeftCollapsed ? leftWidthRef.current : 0;
        const assistantSpace = hasAssistantPane ? assistantWidthRef.current : 0;
        const maxAvailable = hasMainPane
          ? rightMiddleRight - rect.left - leftSpace - assistantSpace - minMainWidth
          : rightMiddleRight - rect.left - leftSpace - assistantSpace;
        // min 宽度在空间不足时让步：lowerBound 由可用空间反推，避免把主区域挤到 0
        const upperBound = Math.max(0, Math.min(maxRightMiddleWidth, maxAvailable));
        const lowerBound = Math.min(minRightMiddleWidth, upperBound);
        const nextWidth = rightMiddleRight - event.clientX;
        const clampedWidth = Math.min(upperBound, Math.max(lowerBound, nextWidth));
        applyRightMiddleWidth(clampedWidth);
      }
      if (activeDivider === 'right' && hasRightPane) {
        const nextWidth = rect.right - event.clientX;
        // 主区域有内容时给它留出最小可用宽度，避免向右拖到底把聊天区挤没；
        // 同时对左侧 / 中间 / 右侧中间面板占用的空间做扣除（它们固定在分隔条左边）。
        const leftSpace = hasLeftPane && !isLeftCollapsed ? leftWidthRef.current : 0;
        const assistantSpace = hasAssistantPane ? assistantWidthRef.current : 0;
        const rightMiddleSpace = hasRightMiddlePane ? rightMiddleWidthRef.current : 0;
        const maxAvailable = hasMainPane
          ? rect.width - leftSpace - assistantSpace - rightMiddleSpace - minMainWidth
          : rect.width - leftSpace - assistantSpace - rightMiddleSpace;
        // 同上：空间不足时允许右面板窄于 minRightWidth，优先保住主区域
        const upperBound = Math.max(0, Math.min(maxRightWidth, maxAvailable));
        const lowerBound = Math.min(minRightWidth, upperBound);
        const clampedWidth = Math.min(upperBound, Math.max(lowerBound, nextWidth));
        applyRightWidth(clampedWidth);
      }
    };

    const onPointerUp = () => {
      if (activeDivider === 'left') {
        onLeftWidthCommit?.(leftWidthRef.current);
      }
      if (activeDivider === 'assistant') {
        onAssistantWidthCommit?.(assistantWidthRef.current);
      }
      if (activeDivider === 'rightMiddle') {
        onRightMiddleWidthCommit?.(rightMiddleWidthRef.current);
      }
      if (activeDivider === 'right') {
        onRightWidthCommit?.(rightWidthRef.current);
      }
      setActiveDivider(null);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    document.body.classList.add('layout-sharp-resizing');

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('layout-sharp-resizing');
    };
  }, [
    activeDivider,
    hasLeftPane,
    hasAssistantPane,
    hasMainPane,
    hasRightMiddlePane,
    hasRightPane,
    isLeftCollapsed,
    onLeftWidthCommit,
    onAssistantWidthCommit,
    onRightMiddleWidthCommit,
    onRightWidthCommit,
    minLeftWidth,
    maxLeftWidth,
    minAssistantWidth,
    maxAssistantWidth,
    minRightMiddleWidth,
    maxRightMiddleWidth,
    minMainWidth,
    minRightWidth,
    maxRightWidth,
  ]);

  const toggleLeftCollapsed = () => {
    const next = !isLeftCollapsed;
    if (leftCollapsed === undefined) {
      setInnerLeftCollapsed(next);
    }
    onLeftCollapsedChange?.(next);
  };

  const toggleRightCollapsed = () => {
    const next = !isRightCollapsed;
    if (rightCollapsed === undefined) {
      setInnerRightCollapsed(next);
    }
    onRightCollapsedChange?.(next);
  };

  const onStartResize = (divider: DividerKey) => {
    // 折叠状态下左侧面板不参与拖拽，避免改变不可见面板的宽度
    if (divider === 'left' && isLeftCollapsed) {
      return;
    }
    // 右侧面板同理：折叠后分隔条只作为展开按钮的载体
    if (divider === 'right' && isRightCollapsed) {
      return;
    }
    // 中间面板撑满剩余宽度时宽度由 flex 决定，拖拽没有意义
    if (divider === 'assistant' && isAssistantExpanded) {
      return;
    }
    setActiveDivider(divider);
  };

  const onDividerDoubleClick = (divider: DividerKey) => {
    if (divider === 'left') {
      if (isLeftCollapsed) {
        return;
      }
      applyLeftWidth(defaultLeftWidth);
      onLeftWidthCommit?.(defaultLeftWidth);
      return;
    }
    if (divider === 'assistant') {
      if (isAssistantExpanded) {
        return;
      }
      applyAssistantWidth(defaultAssistantWidth);
      onAssistantWidthCommit?.(defaultAssistantWidth);
      return;
    }
    if (divider === 'rightMiddle') {
      applyRightMiddleWidth(defaultRightMiddleWidth);
      onRightMiddleWidthCommit?.(defaultRightMiddleWidth);
      return;
    }
    // 折叠状态下双击分隔条没有意义（面板不可见），保持折叠不变。
    if (isRightCollapsed) {
      return;
    }
    applyRightWidth(defaultRightWidth);
    onRightWidthCommit?.(defaultRightWidth);
  };

  const renderDivider = (
    divider: DividerKey,
    label: string,
    extra?: React.ReactNode,
  ) => (
    <div
      className={`layout-sharp-pane-divider${
        divider === 'left' && isLeftCollapsed ? ' is-left-collapsed' : ''
      }${divider === 'right' && isRightCollapsed ? ' is-right-collapsed' : ''} ${
        activeDivider === divider ? 'is-resizing' : ''
      }`}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        className="layout-sharp-pane-divider-line"
        onPointerDown={() => onStartResize(divider)}
        onDoubleClick={() => onDividerDoubleClick(divider)}
      />
      {extra}
    </div>
  );

  return (
    <div ref={workspaceRef} className="layout-sharp-workspace">
      {header ? <div className="layout-sharp-workspace-header">{header}</div> : null}
      <div className="layout-sharp-workspace-body">
        {hasLeftPane && (
          <>
            <div
              className={`layout-sharp-left-pane${isLeftCollapsed ? ' is-collapsed' : ''}`}
              style={{ width: currentLeftWidth }}
              aria-hidden={isLeftCollapsed || undefined}
              inert={isLeftCollapsed || undefined}
            >
              {left}
            </div>
            {renderDivider(
              'left',
              leftResizeLabel,
              showLeftToggle && (
                <button
                  type="button"
                  className="layout-sharp-pane-toggle"
                  title={isLeftCollapsed ? leftExpandLabel : leftCollapseLabel}
                  aria-label={isLeftCollapsed ? leftExpandLabel : leftCollapseLabel}
                  aria-expanded={!isLeftCollapsed}
                  onPointerDown={(event) => event.stopPropagation()}
                  onDoubleClick={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleLeftCollapsed();
                  }}
                >
                  {isLeftCollapsed ? <RightOutlined /> : <LeftOutlined />}
                </button>
              ),
            )}
          </>
        )}
        {hasAssistantPane && (
          <>
            <div
              ref={assistantPaneRef}
              className={`layout-sharp-assistant-pane${
                isAssistantExpanded ? ' is-expanded' : ''
              }`}
              style={isAssistantExpanded ? undefined : { width: currentAssistantWidth }}
            >
              {assistant}
            </div>
            {hasMainPane && renderDivider('assistant', assistantResizeLabel)}
          </>
        )}
        {hasMainPane && <div className="layout-sharp-main-pane">{main}</div>}
        {hasRightMiddlePane && (
          <>
            {hasMainPane && renderDivider('rightMiddle', rightMiddleResizeLabel)}
            <div
              ref={rightMiddlePaneRef}
              className="layout-sharp-right-middle-pane"
              style={{ width: currentRightMiddleWidth }}
            >
              {rightMiddle}
            </div>
          </>
        )}
        {hasRightPane && (
          <>
            {(hasMainPane || hasLeftPane || hasAssistantPane) &&
              !isRightExpanded &&
              renderDivider(
                'right',
                rightResizeLabel,
                showRightToggle && (
                  <button
                    type="button"
                    className="layout-sharp-pane-toggle"
                    title={isRightCollapsed ? rightExpandLabel : rightCollapseLabel}
                    aria-label={isRightCollapsed ? rightExpandLabel : rightCollapseLabel}
                    aria-expanded={!isRightCollapsed}
                    onPointerDown={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleRightCollapsed();
                    }}
                  >
                    {isRightCollapsed ? <LeftOutlined /> : <RightOutlined />}
                  </button>
                ),
              )}
            <div
              className={`layout-sharp-right-pane${isRightExpanded ? ' is-expanded' : ''}${
                isRightCollapsed ? ' is-collapsed' : ''
              }`}
              style={isRightExpanded ? undefined : { width: currentRightWidth }}
              aria-hidden={isRightCollapsed || undefined}
              inert={isRightCollapsed || undefined}
            >
              {right}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SplitWorkspace;
