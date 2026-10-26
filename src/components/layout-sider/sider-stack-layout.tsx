import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './sider-stack-layout.css';

export type SiderStackSectionRenderState = {
  /** 当前分区是否处于折叠态。 */
  collapsed: boolean;
  /** 当前分区是否处于展开态（`!collapsed`）。 */
  expanded: boolean;
  /** 切换当前分区的折叠状态。 */
  toggle: () => void;
};

export type SiderStackSection = {
  key: string;
  /** 折叠时该分区占用的高度（px），仅用于拖拽时的比例换算。 */
  collapsedHeight?: number;
  /** 分区内容；折叠态通常只渲染标题栏，由内容组件自行处理。 */
  render: (state: SiderStackSectionRenderState) => React.ReactNode;
};

export type SiderStackLayoutProps = {
  sections: SiderStackSection[];
  /** 非受控模式下的初始折叠分区 key。 */
  defaultCollapsedKeys?: string[];
  /** 受控模式下的折叠分区 key。 */
  collapsedKeys?: string[];
  onCollapsedKeysChange?: (keys: string[]) => void;
  /** 拖拽时每个分区允许占用的最小高度比例（0-1）。 */
  minRatio?: number;
  resizeLabel?: string;
  className?: string;
};

const DEFAULT_COLLAPSED_HEIGHT = 33;
const DIVIDER_HEIGHT = 6;

/**
 * VS Code 风格的左侧栏纵向堆叠布局。
 *
 * - 多个分区按 `sections` 顺序自上而下排列（第一个在最上面）。
 * - 每个分区可独立折叠：折叠后只保留内容组件自己的标题栏。
 * - 相邻的展开分区之间有一条可拖拽的水平分隔条，双击可恢复均分。
 *
 * 折叠状态与分区标题栏由内容组件自己渲染（通过 render 回调拿到 `collapsed` / `toggle`），
 * 这样面板原有的标题、动作按钮和分页都可以完整保留。
 */
const SiderStackLayout: React.FC<SiderStackLayoutProps> = ({
  sections,
  defaultCollapsedKeys = [],
  collapsedKeys,
  onCollapsedKeysChange,
  minRatio = 0.08,
  resizeLabel = 'Resize panels',
  className,
}) => {
  const [innerCollapsedKeys, setInnerCollapsedKeys] = useState<string[]>(defaultCollapsedKeys);
  const [ratios, setRatios] = useState<number[]>(() => sections.map(() => 1));
  const [activeDivider, setActiveDivider] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ratiosRef = useRef<number[]>(ratios);
  const cleanupRef = useRef<(() => void) | null>(null);

  const currentCollapsedKeys = collapsedKeys ?? innerCollapsedKeys;
  const collapsedKeySet = useMemo(
    () => new Set(currentCollapsedKeys),
    [currentCollapsedKeys],
  );

  // 分区数量变化时重置比例，避免数组错位。
  useEffect(() => {
    setRatios((prev) => {
      if (prev.length === sections.length) {
        return prev;
      }
      const next = sections.map(() => 1);
      ratiosRef.current = next;
      return next;
    });
  }, [sections.length]);

  useEffect(() => {
    ratiosRef.current = ratios;
  }, [ratios]);

  useEffect(
    () => () => {
      cleanupRef.current?.();
      document.body.classList.remove('sider-stack-resizing');
    },
    [],
  );

  const applyCollapsedKeys = useCallback(
    (nextKeys: string[]) => {
      if (collapsedKeys === undefined) {
        setInnerCollapsedKeys(nextKeys);
      }
      onCollapsedKeysChange?.(nextKeys);
    },
    [collapsedKeys, onCollapsedKeysChange],
  );

  const toggleSection = useCallback(
    (key: string) => {
      const isCollapsed = currentCollapsedKeys.includes(key);
      const nextKeys = isCollapsed
        ? currentCollapsedKeys.filter((item) => item !== key)
        : [...currentCollapsedKeys, key];
      applyCollapsedKeys(nextKeys);
    },
    [applyCollapsedKeys, currentCollapsedKeys],
  );

  const resetRatios = useCallback(() => {
    const next = sections.map(() => 1);
    ratiosRef.current = next;
    setRatios(next);
  }, [sections]);

  const handleDividerPointerDown = useCallback(
    (index: number) => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const totalHeight = container.clientHeight;
      if (totalHeight <= 0) {
        return;
      }

      const startY = event.clientY;
      const startRatios = [...ratiosRef.current];

      // 计算可用于分区的净高度：扣掉折叠分区与分隔条占用的空间。
      const collapsedHeight = sections.reduce(
        (sum, section) =>
          collapsedKeySet.has(section.key)
            ? sum + (section.collapsedHeight ?? DEFAULT_COLLAPSED_HEIGHT)
            : sum,
        0,
      );
      const expandedCount = sections.filter(
        (section) => !collapsedKeySet.has(section.key),
      ).length;
      const availableHeight = Math.max(
        1,
        totalHeight - collapsedHeight - Math.max(0, expandedCount - 1) * DIVIDER_HEIGHT,
      );
      const expandedRatioSum =
        sections.reduce(
          (sum, section, sectionIndex) =>
            collapsedKeySet.has(section.key) ? sum : sum + startRatios[sectionIndex],
          0,
        ) || 1;

      setActiveDivider(index);
      document.body.classList.add('sider-stack-resizing');

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaPx = moveEvent.clientY - startY;
        const deltaRatio = (deltaPx * expandedRatioSum) / availableHeight;
        const next = [...startRatios];
        const nextTop = startRatios[index] + deltaRatio;
        const nextBottom = startRatios[index + 1] - deltaRatio;
        if (nextTop < minRatio || nextBottom < minRatio) {
          return;
        }
        next[index] = nextTop;
        next[index + 1] = nextBottom;
        ratiosRef.current = next;
        setRatios(next);
      };

      const handlePointerUp = () => {
        setActiveDivider(null);
        document.body.classList.remove('sider-stack-resizing');
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
        cleanupRef.current = null;
      };

      cleanupRef.current?.();
      cleanupRef.current = handlePointerUp;
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    },
    [collapsedKeySet, minRatio, sections],
  );

  return (
    <div ref={containerRef} className={`sider-stack${className ? ` ${className}` : ''}`}>
      {sections.map((section, index) => {
        const collapsed = collapsedKeySet.has(section.key);
        const previous = sections[index - 1];
        const showDivider =
          index > 0 &&
          !collapsed &&
          Boolean(previous) &&
          !collapsedKeySet.has(previous.key);

        return (
          <React.Fragment key={section.key}>
            {showDivider && (
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label={resizeLabel}
                className={`sider-stack-divider${
                  activeDivider === index - 1 ? ' is-resizing' : ''
                }`}
                onPointerDown={handleDividerPointerDown(index - 1)}
                onDoubleClick={resetRatios}
              />
            )}
            <div
              className={`sider-stack-section${collapsed ? ' is-collapsed' : ''}`}
              style={collapsed ? { flex: '0 0 auto' } : { flex: `${ratios[index] ?? 1} 1 0px` }}
            >
              <div className="sider-stack-section-body">
                {section.render({
                  collapsed,
                  expanded: !collapsed,
                  toggle: () => toggleSection(section.key),
                })}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SiderStackLayout;
