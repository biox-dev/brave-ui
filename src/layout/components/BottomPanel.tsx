import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloseOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { useI18n } from '@/hooks/useI18n';
import {
  MAX_BOTTOM_PANEL_HEIGHT,
  MIN_BOTTOM_PANEL_HEIGHT,
  closeBottomTab,
  setActiveBottomTab,
  setBottomPanelHeight,
  setBottomPanelOpen,
  useBottomPanelStore,
} from '../bottom-panel-store';
import { getBottomTabRenderer } from './bottom-panel-registry';

/**
 * 主区域底部面板（VS Code 风格）：标签栏 + 可拖拽高度的内容区。
 *
 * 关键行为：
 * - 标签列表 / 激活标签 / 展开态 / 高度都来自 `bottom-panel-store`（后端 `menu_config.bottom`），
 *   本组件只负责渲染，不做任何本地持久化；
 * - 内容区按「曾经激活过」的标签挂载并保持挂载，切标签只切 `display`：
 *   终端标签的 WebSocket 一旦卸载就会断开，后端会随之删除临时容器；
 * - 收起面板时内容区仍然挂载（只是隐藏），因此不会误删容器；
 * - 关闭标签才会卸载对应内容 → 断开连接 → 后端删除临时容器。
 */
const BottomPanel: React.FC = () => {
  const { locale } = useI18n();
  const tabs = useBottomPanelStore((state) => state.tabs);
  const active = useBottomPanelStore((state) => state.active);
  const open = useBottomPanelStore((state) => state.open);
  const height = useBottomPanelStore((state) => state.height);
  const panelRef = useRef<HTMLDivElement | null>(null);
  // 已经挂载过的标签：首次激活时才挂载（刷新后恢复的标签不会立刻新建容器）。
  const [mountedKeys, setMountedKeys] = useState<string[]>(() => (active ? [active] : []));

  // 激活标签 → 首次激活时挂载
  useEffect(() => {
    if (!active) {
      return;
    }
    setMountedKeys((prev) => (prev.includes(active) ? prev : [...prev, active]));
  }, [active]);

  // 标签被关闭 → 卸载（终端随之断开并清理临时容器）
  useEffect(() => {
    setMountedKeys((prev) => {
      const next = prev.filter((key) => tabs.some((tab) => tab.key === key));
      return next.length === prev.length ? prev : next;
    });
  }, [tabs]);

  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    const onPointerMove = (moveEvent: PointerEvent) => {
      const parentRect = panelRef.current?.parentElement?.getBoundingClientRect();
      const bottomEdge = parentRect ? parentRect.bottom : window.innerHeight;
      // 至少给主区域留 160px，避免把页面内容完全压没。
      const maxHeight = parentRect
        ? Math.max(MIN_BOTTOM_PANEL_HEIGHT, parentRect.height - 160)
        : MAX_BOTTOM_PANEL_HEIGHT;
      const next = Math.min(maxHeight, Math.max(MIN_BOTTOM_PANEL_HEIGHT, bottomEdge - moveEvent.clientY));
      setBottomPanelHeight(next);
    };
    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('layout-bottom-panel-resizing');
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    document.body.classList.add('layout-bottom-panel-resizing');
  }, []);

  /** 双击分隔条恢复默认高度（与左右面板一致）。 */
  const resetHeight = useCallback(() => {
    const parentRect = panelRef.current?.parentElement?.getBoundingClientRect();
    const maxHeight = parentRect
      ? Math.max(MIN_BOTTOM_PANEL_HEIGHT, parentRect.height - 160)
      : MAX_BOTTOM_PANEL_HEIGHT;
    setBottomPanelHeight(Math.min(maxHeight, 320));
  }, []);

  const onResizerKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    const state = useBottomPanelStore.getState();
    setBottomPanelHeight(state.height + (event.key === 'ArrowUp' ? 24 : -24));
  }, []);

  const emptyNotice = locale === 'en_US' ? 'No bottom panel tab' : '底部面板暂无标签';

  if (tabs.length === 0) {
    return null;
  }

  const toggleLabel = open
    ? locale === 'en_US'
      ? 'Collapse panel'
      : '收起面板'
    : locale === 'en_US'
      ? 'Expand panel'
      : '展开面板';

  return (
    <div
      ref={panelRef}
      className={`layout-bottom-panel${open ? ' is-open' : ' is-collapsed'}`}
      style={open ? { height } : undefined}
    >
      {open && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={locale === 'en_US' ? 'Resize bottom panel' : '调整底部面板高度'}
          tabIndex={0}
          className="layout-bottom-panel-resizer"
          onPointerDown={startResize}
          onDoubleClick={resetHeight}
          onKeyDown={onResizerKeyDown}
        />
      )}
      <div className="layout-bottom-panel-head">
        <div className="layout-bottom-panel-tabs" role="tablist">
          {tabs.map((tab) => {
            const key = tab.key;
            const isActive = key === active && open;
            const title = tab.title || key;
            return (
              <div
                key={key}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                title={title}
                data-bottom-tab-key={key}
                className={`layout-bottom-panel-tab${isActive ? ' is-active' : ''}`}
                onClick={() => setActiveBottomTab(key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveBottomTab(key);
                  }
                }}
              >
                <span className="layout-bottom-panel-tab-label">{title}</span>
                <button
                  type="button"
                  className="layout-bottom-panel-tab-close"
                  tabIndex={-1}
                  aria-label={locale === 'en_US' ? 'Close tab' : '关闭标签页'}
                  title={locale === 'en_US' ? 'Close tab' : '关闭标签页'}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeBottomTab(key);
                  }}
                >
                  <CloseOutlined />
                </button>
              </div>
            );
          })}
        </div>
        <div className="layout-bottom-panel-actions">
          <button
            type="button"
            className="layout-bottom-panel-action"
            title={toggleLabel}
            aria-label={toggleLabel}
            aria-expanded={open}
            onClick={() => setBottomPanelOpen(!open)}
          >
            {open ? <DownOutlined /> : <UpOutlined />}
          </button>
        </div>
      </div>
      <div
        className="layout-bottom-panel-body"
        style={open ? undefined : { display: 'none' }}
      >
        {mountedKeys.length === 0 ? (
          <div className="layout-bottom-panel-placeholder">{emptyNotice}</div>
        ) : (
          mountedKeys.map((key) => {
            const tab = tabs.find((item) => item.key === key);
            if (!tab) {
              return null;
            }
            const Renderer = getBottomTabRenderer(tab.kind);
            return (
              <div
                key={key}
                className="layout-bottom-panel-pane"
                style={{ display: key === active ? 'block' : 'none' }}
              >
                {Renderer ? (
                  <Renderer tab={tab} active={key === active} />
                ) : (
                  <div className="layout-bottom-panel-placeholder">
                    {locale === 'en_US'
                      ? `Unsupported tab type: ${tab.kind}`
                      : `不支持的标签类型：${tab.kind}`}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BottomPanel;
