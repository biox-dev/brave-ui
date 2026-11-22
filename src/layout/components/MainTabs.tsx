import React, { useEffect, useRef } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useI18n } from '@/hooks/useI18n';

/** 标签栏的一项：`key` 是标签身份，`title` 是显示名。 */
export type MainTabItem = {
  key: string;
  title: string;
};

type MainTabsProps = {
  /** 标签列表：顺序即标签栏顺序。 */
  tabs: MainTabItem[];
  /** 当前激活标签的 key。 */
  activeKey?: string;
  /** 点击标签的回调。 */
  onSelect?: (key: string) => void;
  /** 关闭标签的回调。 */
  onClose?: (key: string) => void;
  /** 关闭全部标签的回调；未传时不渲染「关闭全部」按钮。 */
  onCloseAll?: () => void;
};

/**
 * 工作区标签栏：渲染在 SplitWorkspace 的 rightMiddle（如 Agent 会话页）里。
 *
 * 标签由宿主维护（受控模式）：点击 / 关闭只触发回调，组件本身不读写路由、不回填也不落库。
 * 普通页面的路由跳转直接调用 react-router 的 `navigate`，不再经过标签栏。
 */
const MainTabs: React.FC<MainTabsProps> = ({
  tabs,
  activeKey,
  onSelect,
  onClose,
  onCloseAll,
}) => {
  const { locale } = useI18n();
  const tabsRef = useRef<HTMLDivElement | null>(null);

  // 关闭标签只通知宿主，标签的增删由宿主维护。
  const closeTab = (key: string) => {
    onClose?.(key);
  };

  // 标签栏溢出时，支持鼠标滚轮 / 触控板左右滚动（wheel 需要非 passive 才能阻止默认滚动）
  useEffect(() => {
    const container = tabsRef.current;
    if (!container) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (container.scrollWidth <= container.clientWidth) {
        return;
      }
      const delta = event.deltaX !== 0 ? event.deltaX : event.deltaY;
      if (delta === 0) {
        return;
      }
      event.preventDefault();
      container.scrollLeft += delta;
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // 标签过多时把当前激活的标签滚动到可见区域
  useEffect(() => {
    const container = tabsRef.current;
    if (!container || !activeKey) {
      return;
    }
    const active = Array.from(
      container.querySelectorAll<HTMLElement>('[data-tab-key]'),
    ).find((node) => node.dataset.tabKey === activeKey);
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeKey, tabs.length]);

  return (
    <div className="layout-sharp-main-tabs-bar">
      <div className="layout-sharp-main-tabs" ref={tabsRef} role="tablist">
        <div className="layout-sharp-main-tabs-track">
          {tabs.map((tab) => {
            const key = tab.key;
            const title = tab.title || key;
            const isActive = key === activeKey;
            return (
              <div
                key={key}
                data-tab-key={key}
                role="tab"
                tabIndex={0}
                aria-selected={isActive}
                title={title}
                className={`layout-sharp-main-tab${isActive ? ' is-active' : ''}`}
                onClick={() => onSelect?.(key)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect?.(key);
                  }
                }}
                onMouseDown={(event) => {
                  // 中键关闭标签页，同时阻止浏览器默认的自动滚动
                  if (event.button === 1) {
                    event.preventDefault();
                  }
                }}
                onAuxClick={(event) => {
                  if (event.button === 1) {
                    event.preventDefault();
                    closeTab(key);
                  }
                }}
              >
                <span className="layout-sharp-main-tab-label">{title}</span>
                <button
                  type="button"
                  className="layout-sharp-main-tab-close"
                  tabIndex={-1}
                  aria-label={locale === 'en_US' ? 'Close tab' : '关闭标签页'}
                  title={locale === 'en_US' ? 'Close tab' : '关闭标签页'}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(key);
                  }}
                >
                  <CloseOutlined />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {onCloseAll && tabs.length > 0 && (
        <Button
          type="text"
          size="small"
          className="layout-sharp-main-tabs-close-all"
          icon={<CloseOutlined />}
          aria-label={locale === 'en_US' ? 'Close all tabs' : '关闭全部标签页'}
          title={locale === 'en_US' ? 'Close all tabs' : '关闭全部标签页'}
          onClick={onCloseAll}
        />
      )}
    </div>
  );
};

export default MainTabs;
