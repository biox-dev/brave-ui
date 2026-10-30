import React, { useEffect, useRef, useState } from 'react';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

type SplitWorkspaceProps = {
  left?: React.ReactNode;
  main?: React.ReactNode;
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
  rightWidth?: number;
  onLeftWidthChange?: (width: number) => void;
  onRightWidthChange?: (width: number) => void;
  onLeftWidthCommit?: (width: number) => void;
  onRightWidthCommit?: (width: number) => void;
  leftResizeLabel?: string;
  rightResizeLabel?: string;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  defaultLeftWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  defaultRightWidth?: number;
  mobileBreakpoint?: number;
};

const SplitWorkspace: React.FC<SplitWorkspaceProps> = ({
  left,
  main,
  right,
  expandRight = false,
  leftCollapsed,
  onLeftCollapsedChange,
  showLeftToggle = true,
  leftCollapseLabel = 'Hide left panel',
  leftExpandLabel = 'Show left panel',
  leftWidth,
  rightWidth,
  onLeftWidthChange,
  onRightWidthChange,
  onLeftWidthCommit,
  onRightWidthCommit,
  leftResizeLabel = 'Resize left panel',
  rightResizeLabel = 'Resize right panel',
  minLeftWidth = 240,
  maxLeftWidth = 560,
  defaultLeftWidth = 320,
  minRightWidth = 280,
  maxRightWidth = 640,
  defaultRightWidth = 360,
  mobileBreakpoint = 991,
}) => {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const leftWidthRef = useRef(defaultLeftWidth);
  const rightWidthRef = useRef(defaultRightWidth);
  const leftWidthPropRef = useRef<number | undefined>(leftWidth);
  const rightWidthPropRef = useRef<number | undefined>(rightWidth);
  const [activeDivider, setActiveDivider] = useState<'left' | 'right' | null>(null);
  const [innerLeftWidth, setInnerLeftWidth] = useState(defaultLeftWidth);
  const [innerRightWidth, setInnerRightWidth] = useState(defaultRightWidth);
  const [innerLeftCollapsed, setInnerLeftCollapsed] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const hasLeftPane = Boolean(left);
  const hasMainPane = Boolean(main);
  const hasRightPane = Boolean(right);
  // 移动端左右面板是上下堆叠的，折叠只在桌面端生效，避免隐藏后无法恢复
  const isLeftCollapsed = Boolean(leftCollapsed ?? innerLeftCollapsed) && !isCompact;
  // 主区域没有内容时，右侧面板撑满剩余空间
  const isRightExpanded = expandRight && !hasMainPane && hasRightPane;
  const currentLeftWidth = Math.min(
    maxLeftWidth,
    Math.max(minLeftWidth, leftWidth ?? innerLeftWidth),
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
    rightWidthPropRef.current = rightWidth;
  }, [rightWidth]);

  useEffect(() => {
    leftWidthRef.current = currentLeftWidth;
  }, [currentLeftWidth]);

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
      if (activeDivider === 'right' && hasRightPane) {
        const nextWidth = rect.right - event.clientX;
        const clampedWidth = Math.min(maxRightWidth, Math.max(minRightWidth, nextWidth));
        applyRightWidth(clampedWidth);
      }
    };

    const onPointerUp = () => {
      if (activeDivider === 'left') {
        onLeftWidthCommit?.(leftWidthRef.current);
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
    hasRightPane,
    onLeftWidthCommit,
    onRightWidthCommit,
    minLeftWidth,
    maxLeftWidth,
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

  const onStartResize = (divider: 'left' | 'right') => {
    // 折叠状态下左侧面板不参与拖拽，避免改变不可见面板的宽度
    if (divider === 'left' && isLeftCollapsed) {
      return;
    }
    if (window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches) {
      return;
    }
    setActiveDivider(divider);
  };

  const onDividerDoubleClick = (divider: 'left' | 'right') => {
    if (divider === 'left') {
      if (isLeftCollapsed) {
        return;
      }
      applyLeftWidth(defaultLeftWidth);
      onLeftWidthCommit?.(defaultLeftWidth);
      return;
    }
    applyRightWidth(defaultRightWidth);
    onRightWidthCommit?.(defaultRightWidth);
  };

  const renderDivider = (
    divider: 'left' | 'right',
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
      {hasMainPane && <div className="layout-sharp-main-pane">{main}</div>}
      {hasRightPane && (
        <>
          {hasMainPane && !isRightExpanded && renderDivider('right', rightResizeLabel)}
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
