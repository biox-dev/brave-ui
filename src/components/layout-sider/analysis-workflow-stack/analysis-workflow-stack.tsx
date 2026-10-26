import { useMemo } from 'react';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useI18n } from '@/hooks/useI18n';
import SiderStackLayout, { type SiderStackSection } from '../sider-stack-layout';

/**
 * 左侧栏纵向堆叠视图：上方「分析列表」，下方「流程页」。
 *
 * 布局行为与 `analysisScriptStack` 一致：标题栏点击折叠，展开时中间分隔条可拖拽调高度，双击恢复均分。
 */
const AnalysisWorkflowStack = () => {
  const { locale } = useI18n();

  const sections = useMemo<SiderStackSection[]>(
    () => [
      {
        key: 'analysisList',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="analysisList"
            collapsed={collapsed}
            onToggleCollapse={toggle}
          />
        ),
      },
      {
        key: 'workflowPage',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="workflowPage"
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
      resizeLabel={locale === 'en_US' ? 'Resize panels' : '调整面板高度'}
    />
  );
};

export default AnalysisWorkflowStack;
