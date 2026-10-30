import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router';
import { useI18n } from '@/hooks/useI18n';
import { normalizeMainTabPath, resolveMainTabTitle } from '../main-tab-title';

const STORAGE_KEY = 'mainTabs';
const MAX_TABS = 16;

export type MainTabsHandle = {
  /** 关闭当前激活的标签页（用于主卡片头部的关闭按钮）。 */
  closeActiveTab: () => void;
};

const readStoredKeys = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string' && item !== '/');
  } catch {
    return [];
  }
};

/**
 * 主区域顶部的标签页。
 * 只记录访问过的路由并负责切换/关闭，页面内容仍由上层 <Outlet /> 渲染，
 * 因此切换标签页等价于路由跳转（页面组件会重新挂载）。
 */
const MainTabs = forwardRef<MainTabsHandle>((_props, ref) => {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [keys, setKeys] = useState<string[]>(readStoredKeys);
  const tabsRef = useRef<HTMLDivElement | null>(null);

  const currentKey = `${normalizeMainTabPath(pathname)}${search}`;
  const isRoot = normalizeMainTabPath(pathname) === '/';

  // 路由变化时把当前地址加入标签页
  useEffect(() => {
    if (isRoot) {
      return;
    }
    setKeys((prev) =>
      prev.includes(currentKey)
        ? prev
        : [...prev, currentKey].slice(Math.max(0, prev.length + 1 - MAX_TABS)),
    );
  }, [currentKey, isRoot]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
    } catch {
      // 忽略存储失败（隐私模式 / 配额不足）
    }
  }, [keys]);

  const closeTab = useCallback(
    (key: string) => {
      const index = keys.indexOf(key);
      if (index < 0) {
        return;
      }
      const next = keys.filter((item) => item !== key);
      setKeys(next);
      if (key === currentKey) {
        // 关闭当前标签：优先切到右侧相邻标签，没有则切到左侧，全部关闭后回到根路由
        const fallback = next[index] ?? next[index - 1] ?? null;
        navigate(fallback ?? '/');
      }
    },
    [currentKey, keys, navigate],
  );

  useImperativeHandle(ref, () => ({ closeActiveTab: () => closeTab(currentKey) }), [
    closeTab,
    currentKey,
  ]);

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
    if (isRoot || !container) {
      return;
    }
    const active = Array.from(
      container.querySelectorAll<HTMLElement>('[data-tab-key]'),
    ).find((node) => node.dataset.tabKey === currentKey);
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [currentKey, isRoot, keys.length]);

  return (
    <div className="layout-sharp-main-tabs" ref={tabsRef} role="tablist">
      <div className="layout-sharp-main-tabs-track">
        {keys.map((key) => {
          const title = resolveMainTabTitle(key, locale);
          const isActive = key === currentKey && !isRoot;
          return (
            <div
              key={key}
              data-tab-key={key}
              role="tab"
              tabIndex={0}
              aria-selected={isActive}
              title={title}
              className={`layout-sharp-main-tab${isActive ? ' is-active' : ''}`}
              onClick={() => navigate(key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(key);
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
  );
});

MainTabs.displayName = 'MainTabs';

export default MainTabs;
