import { useMemo } from 'react';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useI18n } from '@/hooks/useI18n';
import SiderStackLayout, { type SiderStackSection } from '../sider-stack-layout';
import { useSiderStackCollapsed } from '../use-sider-stack-collapsed';

/**
 * 左侧栏纵向堆叠视图：上方「容器模板列表」，下方「终端会话」。
 *
 * 布局行为与 `analysisScriptStack` 完全一致：两个面板各自保留标题栏与动作按钮，
 * 标题栏点击即可折叠（VS Code 风格），展开时中间的分隔条可以拖拽调整高度比例，
 * 双击恢复均分。
 *
 * 下方的会话列表把内存注册表里的 TerminalSession 与容器模板绑定行 join 起来展示，
 * 点击行与模板列表点击行为一致（在底部面板打开同一个终端标签）。
 */
const ContainerTemplateStack = () => {
  const { locale } = useI18n();
  // 折叠状态持久化：切换面板 / 刷新浏览器后保持原样。
  const [collapsedKeys, setCollapsedKeys] = useSiderStackCollapsed('containerTemplateStack');

  const sections = useMemo<SiderStackSection[]>(
    () => [
      {
        key: 'containerTemplateList',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="containerTemplateList"
            collapsed={collapsed}
            onToggleCollapse={toggle}
          />
        ),
      },
      {
        key: 'containerTerminalSessionList',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="containerTerminalSessionList"
            collapsed={collapsed}
            onToggleCollapse={toggle}
          />
        ),
      },
    ],
    [],
  );

  return (
    <SiderStackLayout
      sections={sections}
      collapsedKeys={collapsedKeys}
      onCollapsedKeysChange={setCollapsedKeys}
      resizeLabel={locale === 'en_US' ? 'Resize panels' : '调整面板高度'}
    />
  );
};

export default ContainerTemplateStack;
