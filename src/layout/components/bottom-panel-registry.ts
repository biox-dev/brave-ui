import type { ComponentType } from 'react';
import type { BottomTab } from '../bottom-panel-store';
import TerminalBottomTab from './bottom-panel-terminal';

/**
 * 底部面板标签渲染器的入参。
 *
 * 标签切换通过 `display` 控制显隐，组件本身**不会被卸载**：
 * 终端依赖 WebSocket 连接（关闭即删除临时容器），切标签 / 收起面板都不能断。
 */
export type BottomTabRenderProps = {
  tab: BottomTab;
  /** 是否为当前激活标签。 */
  active: boolean;
};

const renderers: Record<string, ComponentType<BottomTabRenderProps>> = {
  terminal: TerminalBottomTab,
};

/**
 * 注册新的底部标签类型，例如后续的日志面板：
 * `registerBottomTabRenderer('log', LogBottomTab)`。
 */
export const registerBottomTabRenderer = (
  kind: string,
  renderer: ComponentType<BottomTabRenderProps>,
): void => {
  renderers[kind] = renderer;
};

/** 取某个 kind 的渲染器；未注册返回 undefined（面板显示「不支持的标签类型」）。 */
export const getBottomTabRenderer = (kind: string): ComponentType<BottomTabRenderProps> | undefined =>
  renderers[kind];
