import { useMemo } from 'react';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useI18n } from '@/hooks/useI18n';
import SiderStackLayout, { type SiderStackSection } from '../sider-stack-layout';

/**
 * 左侧栏纵向堆叠视图：上方「分析节点列表」，下方「脚本页」。
 *
 * 两个面板各自保留原有的标题栏与动作按钮，标题栏点击即可折叠（VS Code 风格），
 * 展开时中间的分隔条可以拖拽调整高度比例，双击恢复均分。
 */
const AnalysisScriptStack = () => {
  const { locale } = useI18n();

  const sections = useMemo<SiderStackSection[]>(
    () => [
      {
        key: 'analysisNodeList',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="analysisNodeList"
            collapsed={collapsed}
            onToggleCollapse={toggle}
          />
        ),
      },
      {
        key: 'scriptPage',
        render: ({ collapsed, toggle }) => (
          <ViewResolver
            view="scriptPage"
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

export default AnalysisScriptStack;
