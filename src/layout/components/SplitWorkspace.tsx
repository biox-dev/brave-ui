import React, { useEffect, useRef, useState } from 'react';

type SplitWorkspaceProps = {
  left?: React.ReactNode;
  main: React.ReactNode;
  right?: React.ReactNode;
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
  const hasLeftPane = Boolean(left);
  const hasRightPane = Boolean(right);
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

  const onStartResize = (divider: 'left' | 'right') => {
    if (window.matchMedia(`(max-width: ${mobileBreakpoint}px)`).matches) {
      return;
    }
    setActiveDivider(divider);
  };

  return (
    <div ref={workspaceRef} className="layout-sharp-workspace">
      {hasLeftPane && (
        <>
          <div className="layout-sharp-left-pane" style={{ width: currentLeftWidth }}>
            {left}
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={leftResizeLabel}
            className={`layout-sharp-pane-divider ${activeDivider === 'left' ? 'is-resizing' : ''}`}
            onPointerDown={() => onStartResize('left')}
            onDoubleClick={() => {
              applyLeftWidth(defaultLeftWidth);
              onLeftWidthCommit?.(defaultLeftWidth);
            }}
          />
        </>
      )}
      <div className="layout-sharp-main-pane">{main}</div>
      {hasRightPane && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={rightResizeLabel}
            className={`layout-sharp-pane-divider ${activeDivider === 'right' ? 'is-resizing' : ''}`}
            onPointerDown={() => onStartResize('right')}
            onDoubleClick={() => {
              applyRightWidth(defaultRightWidth);
              onRightWidthCommit?.(defaultRightWidth);
            }}
          />
          <div className="layout-sharp-right-pane" style={{ width: currentRightWidth }}>
            {right}
          </div>
        </>
      )}
    </div>
  );
};

export default SplitWorkspace;
