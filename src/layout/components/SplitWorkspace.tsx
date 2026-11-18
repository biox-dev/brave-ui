import React, { useEffect, useRef, useState } from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

type SplitWorkspaceProps = {
  left?: React.ReactNode;
  main?: React.ReactNode;
  /** 中间面板（如 Assistant）：渲染在 left 与 main 之间 */
  assistant?: React.ReactNode;
  right?: React.ReactNode;
  /** 主区域无内容时，让右侧面板拉伸占满剩余空间 */
  expandRight?: boolean;
  /** 左侧面板是否折叠隐藏（受控）；不传时组件内部维护 */
  leftCollapsed?: boolean;
  onLeftCollapsedChange?: (collapsed: boolean) => void;
  /** 是否显示左侧面板折叠按钮 */
  showLeftToggle?: boolean;
  leftCollapseLabel?: string;
  leftExpandLabel?: string;
  leftWidth?: number;
  assistantWidth?: number;
  rightWidth?: number;
  onLeftWidthChange?: (width: number) => void;
  onAssistantWidthChange?: (width: number) => void;
  onRightWidthChange?: (width: number) => void;
  onLeftWidthCommit?: (width: number) => void;
  onAssistantWidthCommit?: (width: number) => void;
  onRightWidthCommit?: (width: number) => void;
  leftResizeLabel?: string;
  assistantResizeLabel?: string;
  rightResizeLabel?: string;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  defaultLeftWidth?: number;
  minAssistantWidth?: number;
  maxAssistantWidth?: number;
  defaultAssistantWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  defaultRightWidth?: number;
  /** 拖动右侧分隔条时，主区域（如 agentChat）至少保留的宽度（px）。 */
  minMainWidth?: number;
  mobileBreakpoint?: number;
};

type DividerKey = 'left' | 'assistant' | 'right';

const SplitWorkspace: React.FC<SplitWorkspaceProps> = ({
  left,
  main,
  assistant,
  right,
  expandRight = false,
  leftCollapsed,
  onLeftCollapsedChange,
  showLeftToggle = true,
  leftCollapseLabel = 'Hide left panel',
  leftExpandLabel = 'Show left panel',
  leftWidth,
  assistantWidth,
  rightWidth,
  onLeftWidthChange,
  onAssistantWidthChange,
  onRightWidthChange,
  onLeftWidthCommit,
  onAssistantWidthCommit,
  onRightWidthCommit,
  leftResizeLabel = 'Resize left panel',
  assistantResizeLabel = 'Resize assistant panel',
  rightResizeLabel = 'Resize right panel',
  minLeftWidth = 240,
  maxLeftWidth = 560,
  defaultLeftWidth = 320,
  minAssistantWidth = 240,
  maxAssistantWidth = 560,
  defaultAssistantWidth = 320,
  minRightWidth = 280,
  maxRightWidth = 640,
  defaultRightWidth = 360,
  minMainWidth = 320,
  mobileBreakpoint = 991,
}) => {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const assistantPaneRef = useRef<HTMLDivElement | null>(null);
  const leftWidthRef = useRef(defaultLeftWidth);
  const assistantWidthRef = useRef(defaultAssistantWidth);
  const rightWidthRef = useRef(defaultRightWidth);
  const leftWidthPropRef = useRef<number | undefined>(leftWidth);
  const assistantWidthPropRef = useRef<number | undefined>(assistantWidth);
  const rightWidthPropRef = useRef<number | undefined>(rightWidth);
  const [activeDivider, setActiveDivider] = useState<DividerKey | null>(null);
  const [innerLeftWidth, setInnerLeftWidth] = useState(defaultLeftWidth);
  const [innerAssistantWidth, setInnerAssistantWidth] = useState(defaultAssistantWidth);
  const [innerRightWidth, setInnerRightWidth] = useState(defaultRightWidth);
  const [innerLeftCollapsed, setInnerLeftCollapsed] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const hasLeftPane = Boolean(left);
  const hasMainPane = Boolean(main);
  const hasAssistantPane = Boolean(assistant);
  const hasRightPane = Boolean(right);
  // 移动端左右面板是上下堆叠的，折叠只在桌面端生效，避免隐藏后无法恢复
  const isLeftCollapsed = Boolean(leftCollapsed ?? innerLeftCollapsed) && !isCompact;
  // 主区域没有内容时，由最靠近主区域的面板撑满剩余空间：有中间面板时是中间面板，否则是右侧面板
  const isRightExpanded = expandRight && !hasMainPane && hasRightPane && !hasAssistantPane;
  const isAssistantExpanded = expandRight && !hasMainPane && hasAssistantPane;
  const currentLeftWidth = Math.min(
    maxLeftWidth,
    Math.max(minLeftWidth, leftWidth ?? innerLeftWidth),
  );
  const currentAssistantWidth = Math.min(
    maxAssistantWidth,
    Math.max(minAssistantWidth, assistantWidth ?? innerAssistantWidth),
  );
  const currentRightWidth = Math.min(
    maxRightWidth,
    Math.max(minRightWidth, rightWidth ?? innerRightWidth),
  );

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
    const mediaQuery = window.matchMedia(`(max-width: ${mobileBreakpoint}px)`);
    const syncCompact = () => setIsCompact(mediaQuery.matches);
    syncCompact();
    mediaQuery.addEventListener('change', syncCompact);
    return () => mediaQuery.removeEventListener('change', syncCompact);
  }, [mobileBreakpoint]);

  useEffect(() => {
    leftWidthPropRef.current = leftWidth;
  }, [leftWidth]);

  useEffect(() => {
    assistantWidthPropRef.current = assistantWidth;
  }, [assistantWidth]);

  useEffect(() => {
    rightWidthPropRef.current = rightWidth;
  }, [rightWidth]);

  useEffect(() => {
    leftWidthRef.current = currentLeftWidth;
  }, [currentLeftWidth]);

  useEffect(() => {
    assistantWidthRef.current = currentAssistantWidth;
  }, [currentAssistantWidth]);

  useEffect(() => {
    rightWidthRef.current = currentRightWidth;
  }, [currentRightWidth]);

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
      if (activeDivider === 'right' && hasRightPane) {
        const nextWidth = rect.right - event.clientX;
        // 主区域有内容时给它留出最小可用宽度，避免向右拖到底把聊天区挤没；
        // 同时对左侧 / 中间面板占用的空间做扣除（它们固定在分隔条左边）。
        const leftSpace = hasLeftPane && !isLeftCollapsed ? leftWidthRef.current : 0;
        const assistantSpace = hasAssistantPane ? assistantWidthRef.current : 0;
        const maxAvailable = hasMainPane
          ? rect.width - leftSpace - assistantSpace - minMainWidth
          : rect.width - leftSpace - assistantSpace;
        const upperBound = Math.max(
          minRightWidth,
          Math.min(maxRightWidth, maxAvailable),
        );
        const clampedWidth = Math.min(upperBound, Math.max(minRightWidth, nextWidth));
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
    hasRightPane,
    isLeftCollapsed,
    onLeftWidthCommit,
    onAssistantWidthCommit,
    onRightWidthCommit,
    minLeftWidth,
    maxLeftWidth,
    minAssistantWidth,
    maxAssistantWidth,
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

  const onStartResize = (divider: DividerKey) => {
    // 折叠状态下左侧面板不参与拖拽，避免改变不可见面板的宽度
    if (divider === 'left' && isLeftCollapsed) {
      return;
    }
    // 中间面板撑满剩余宽度时宽度由 flex 决定，拖拽没有意义
    if (divider === 'assistant' && isAssistantExpanded) {
      return;
    }
    if (window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches) {
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
      } ${activeDivider === divider ? 'is-resizing' : ''}`}
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
      {hasRightPane && (
        <>
          {(hasMainPane || hasLeftPane || hasAssistantPane) &&
            !isRightExpanded &&
            renderDivider('right', rightResizeLabel)}
          <div
            className={`layout-sharp-right-pane${isRightExpanded ? ' is-expanded' : ''}`}
            style={isRightExpanded ? undefined : { width: currentRightWidth }}
          >
            {right}
          </div>
        </>
      )}
    </div>
  );
};

export default SplitWorkspace;
