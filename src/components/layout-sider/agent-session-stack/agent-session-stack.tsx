import { useMemo } from 'react';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useI18n } from '@/hooks/useI18n';
import SiderStackLayout, { type SiderStackSection } from '../sider-stack-layout';
import { useSiderStackCollapsed } from '../use-sider-stack-collapsed';

/**
 * 左侧栏纵向堆叠视图：上方「智能体会话」，下方「项目文件」。
 *
 * 布局行为与其他堆叠视图（analysisScriptStack / containerTemplateStack）一致：
 * 两个面板各自保留标题栏与动作按钮，标题栏点击即可折叠（VS Code 风格），
 * 展开时中间的分隔条可以拖拽调整高度比例，双击恢复均分。
 */
const AgentSessionStack = () => {
  const { locale } = useI18n();
  // 折叠状态持久化：切换面板 / 刷新浏览器后保持原样。
  const [collapsedKeys, setCollapsedKeys] = useSiderStackCollapsed('agentSessionStack');

  const sections = useMemo<SiderStackSection[]>(
    () => [
      {
        // 智能体会话列表（layout-sider/agent-session/agent-session-list.tsx）。
        key: 'agentSessionList',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="agentSessionList"
            collapsed={collapsed}
            onToggleCollapse={toggle}
          />
        ),
      },
      {
        // 项目文件（components/layout-sider/data-dataset-page/project-file-page.tsx）。
        key: 'projectFilePage',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="projectFilePage"
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

export default AgentSessionStack;
