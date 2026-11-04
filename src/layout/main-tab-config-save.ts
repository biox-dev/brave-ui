import { updateMenuConfigApi, type UserMenuTab } from '@/api/auth';

/**
 * 主区域标签页配置的防抖落库。
 *
 * 单独成模块（而不是放在 `MainTabs.tsx` 里）有两个原因：
 * 1. 切换项目时需要在 `activate-project` 之前取消尚未发出的请求，调用方在别的文件里；
 * 2. 组件文件只导出组件，避免 Fast Refresh 失效。
 */

/** 标签页配置落库的防抖窗口：连续开关标签 / 改名只提交最后一次。 */
const SAVE_MENU_TABS_DELAY = 800;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingTabs: UserMenuTab[] = [];

/**
 * 后台异步保存标签页配置：不 await、不弹提示、不驱动 loading。
 * redux 里已是最新状态，落库失败不影响使用，下次变更会重新提交整份列表。
 */
export const scheduleSaveMenuTabs = (tabs: UserMenuTab[]) => {
  pendingTabs = tabs;
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    updateMenuConfigApi(pendingTabs).catch(() => {
      // 忽略：菜单配置属体验性数据，不打扰用户
    });
  }, SAVE_MENU_TABS_DELAY);
};

/**
 * 丢弃尚未发出的标签页保存请求。
 *
 * 菜单配置写入的是「服务端当前激活项目」：切换项目必须在 activate 之前调用，
 * 否则防抖中的旧项目标签页会在切换完成之后才发出，被写到新项目上。
 */
export const cancelPendingMenuTabsSave = () => {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingTabs = [];
};
