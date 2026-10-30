import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '@/hooks/useI18n';
import { useMainTabTitles } from '@/hooks/useMainTabTitle';
import { updateMenuConfigApi, type UserMenuTab } from '@/api/auth';
import { setUserMenuTabs } from '@/store/userSlice';
import {
  clearMainTabTitle,
  pruneMainTabTitles,
  seedMainTabTitles,
  toMainTabKey,
} from '../main-tab-title-store';
import { normalizeMainTabPath, resolveMainTabTitle } from '../main-tab-title';

const MAX_TABS = 16;
/** 标签页配置落库的防抖窗口：连续开关标签 / 改名只提交最后一次。 */
const SAVE_MENU_TABS_DELAY = 800;

let saveMenuTabsTimer: ReturnType<typeof setTimeout> | null = null;
let pendingMenuTabs: UserMenuTab[] = [];

/**
 * 后台异步保存标签页配置：不 await、不弹提示、不驱动 loading。
 * redux 里已是最新状态，落库失败不影响使用，下次变更会重新提交整份列表。
 */
const scheduleSaveMenuTabs = (tabs: UserMenuTab[]) => {
  pendingMenuTabs = tabs;
  if (saveMenuTabsTimer) {
    clearTimeout(saveMenuTabsTimer);
  }
  saveMenuTabsTimer = setTimeout(() => {
    saveMenuTabsTimer = null;
    updateMenuConfigApi(pendingMenuTabs).catch(() => {
      // 忽略：菜单配置属体验性数据，不打扰用户
    });
  }, SAVE_MENU_TABS_DELAY);
};

export type MainTabsHandle = {
  /** 关闭当前激活的标签页（用于主卡片头部的关闭按钮）。 */
  closeActiveTab: () => void;
};

/**
 * 主区域顶部的标签页。
 * 只记录访问过的路由并负责切换/关闭，页面内容仍由上层 <Outlet /> 渲染，
 * 因此切换标签页等价于路由跳转（页面组件会重新挂载）。
 *
 * 标签页列表的唯一数据源是后端：`/auth/me` 的 `user.menu_config.tabs` 回填，
 * 之后的每次新增 / 关闭 / 改名都异步回写（不阻塞 UI）。
 */
const MainTabs = forwardRef<MainTabsHandle>((_props, ref) => {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { pathname, search } = useLocation();

  const currentKey = `${normalizeMainTabPath(pathname)}${search}`;
  const isRoot = normalizeMainTabPath(pathname) === '/';

  const userId = useSelector((state: any) => state.user.userInfo?.id as string | undefined);
  // 注意：selector 必须返回稳定引用，否则每次 render 都会被当成变化。
  const menuConfig = useSelector((state: any) => state.user.userInfo?.menu_config);
  const serverTabs = useMemo<UserMenuTab[]>(() => menuConfig?.tabs ?? [], [menuConfig]);

  // null = 接口数据还没到：此时不渲染标签、也不落库，避免用空列表覆盖后端。
  // 本地状态直接持有 url + title：渲染与落库都用它，redux 里的 menu_config 只是同步出去的副本。
  const [tabs, setTabs] = useState<UserMenuTab[] | null>(null);
  const tabsRef = useRef<HTMLDivElement | null>(null);
  // 各组件登记的可读名称（如节点名）；没登记的标签页回退到静态标题规则。
  const titleOverrides = useMainTabTitles();
  // 已回填过的用户 ID（换账号时重新回填）与最近一次已同步的标签页快照（避免重复请求）。
  const hydratedUserRef = useRef<string | null>(null);
  const savedSignatureRef = useRef<string | null>(null);

  // 1) 回填：/auth/me 返回后，用后端列表 + 名称建立标签栏，并补上当前深链路由。
  useEffect(() => {
    if (!userId || hydratedUserRef.current === userId) {
      return;
    }
    hydratedUserRef.current = userId;
    seedMainTabTitles(serverTabs);
    const next: UserMenuTab[] = serverTabs
      .map((tab) => ({ url: toMainTabKey(tab.url), title: (tab.title ?? '').trim() }))
      .filter((tab) => tab.url !== '/');
    // 后端已有内容：先记成「已同步」，避免回填后立刻再发一次相同的请求
    savedSignatureRef.current = JSON.stringify(next);
    if (!isRoot && !next.some((tab) => tab.url === currentKey)) {
      // 当前深链路由不在后端列表里 → 补一个，由下一轮同步落库
      next.push({ url: currentKey, title: '' });
    }
    setTabs(next.slice(-MAX_TABS));
  }, [currentKey, isRoot, serverTabs, userId]);

  // 2) 路由变化时把当前地址加入标签页（已存在则不动，避免覆盖已登记的名称）
  useEffect(() => {
    if (isRoot) {
      return;
    }
    setTabs((prev) =>
      prev && !prev.some((tab) => tab.url === currentKey)
        ? [...prev, { url: currentKey, title: '' }].slice(-MAX_TABS)
        : prev,
    );
  }, [currentKey, isRoot]);

  // 3) 把本地标签页的显示名同步成最新（页面登记的节点名可能晚于标签页创建）。
  // 只在名称真的变化时才换状态，避免无意义的重渲染。
  useEffect(() => {
    if (!tabs) {
      return;
    }
    const next = tabs.map((tab) => ({
      url: tab.url,
      title: titleOverrides[tab.url] ?? '',
    }));
    if (next.every((tab, index) => tab.title === tabs[index].title)) {
      return;
    }
    setTabs(next);
  }, [tabs, titleOverrides]);

  // 4) 标签页变化后同步到 redux 并异步落库。
  useEffect(() => {
    if (!tabs) {
      return;
    }
    const signature = JSON.stringify(tabs);
    if (signature === savedSignatureRef.current) {
      return;
    }
    savedSignatureRef.current = signature;
    dispatch(setUserMenuTabs(tabs));
    scheduleSaveMenuTabs(tabs);
  }, [dispatch, tabs]);

  // 5) 清理已关闭标签页残留的名称
  useEffect(() => {
    if (!tabs) {
      return;
    }
    pruneMainTabTitles([...tabs.map((tab) => tab.url), currentKey]);
  }, [currentKey, tabs]);

  const closeTab = useCallback(
    (key: string) => {
      if (!tabs) {
        return;
      }
      const index = tabs.findIndex((tab) => tab.url === key);
      if (index < 0) {
        return;
      }
      const next = tabs.filter((tab) => tab.url !== key);
      setTabs(next);
      // 标签页关闭后同步清理它登记的名称
      clearMainTabTitle(key);
      if (key === currentKey) {
        // 关闭当前标签：优先切到右侧相邻标签，没有则切到左侧，全部关闭后回到根路由
        const fallback = next[index]?.url ?? next[index - 1]?.url ?? null;
        navigate(fallback ?? '/');
      }
    },
    [currentKey, tabs, navigate],
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
  }, [currentKey, isRoot, tabs?.length]);

  return (
    <div className="layout-sharp-main-tabs" ref={tabsRef} role="tablist">
      <div className="layout-sharp-main-tabs-track">
        {(tabs ?? []).map((tab) => {
          const key = tab.url;
          const title = tab.title || resolveMainTabTitle(key, locale);
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
