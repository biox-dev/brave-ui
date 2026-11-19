import { useMemo } from 'react';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useI18n } from '@/hooks/useI18n';
import SiderStackLayout, { type SiderStackSection } from '../sider-stack-layout';
import { useSiderStackCollapsed } from '../use-sider-stack-collapsed';

/**
 * 左侧栏纵向堆叠视图：上方「项目报告」，下方「参考文献」。
 *
 * 布局行为与其他堆叠视图（analysisScriptStack / agentSessionStack）一致：
 * 两个面板各自保留标题栏与动作按钮，标题栏点击即可折叠（VS Code 风格），
 * 展开时中间的分隔条可以拖拽调整高度比例，双击恢复均分。
 */
const ProjectReportLiteratureStack = () => {
  const { locale } = useI18n();
  // 折叠状态持久化：切换面板 / 刷新浏览器后保持原样。
  const [collapsedKeys, setCollapsedKeys] = useSiderStackCollapsed('projectReportLiteratureStack');

  const sections = useMemo<SiderStackSection[]>(
    () => [
      {
        // 项目报告列表（layout-sider/project-report/project-report-list.tsx）。
        key: 'projectReport',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="projectReport"
            collapsed={collapsed}
            onToggleCollapse={toggle}
          />
        ),
      },
      {
        // 项目参考文献列表（layout-sider/literature/project-literature-list.tsx）。
        key: 'projectLiterature',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="projectLiterature"
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

export default ProjectReportLiteratureStack;
