import React, { useEffect, useMemo, useState } from 'react';
import { AppstoreOutlined, DeploymentUnitOutlined, FileTextOutlined, SettingOutlined, CodeOutlined, CommentOutlined } from '@ant-design/icons';
import { Dropdown, Layout, theme } from 'antd';
import { Outlet, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '@/hooks/useI18n';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import ContainerQueueMonitor from '@/components/container-manager/container-monitor';
import RuntimeStatus from '@/components/runtime-status';
import { setUserItem } from '@/store/userSlice';
import { closeLeftMiddlePane } from './left-middle-pane-store';
import { useLeftMiddlePaneState } from '@/hooks/useLeftMiddlePane';
import { buildLayoutMenus, type LayoutLocale } from './layout-menu';
import AppHeader from './components/AppHeader';
import ActivityBar from './components/ActivityBar';
import SplitWorkspace from './components/SplitWorkspace.tsx';
import BottomPanel from './components/BottomPanel';
import { hydrateBottomPanel } from './bottom-panel-store';
import './indexV2.css';

const { Content, Footer, Sider } = Layout;

// leftMiddle 的视图名由左侧列表页在运行时登记（如 projectReportItems），
// 这里把 ViewResolver 的强类型联合放宽成 string，避免每处都 `as any`。
const LeftMiddlePaneView = ViewResolver as unknown as React.FC<{
  view: string;
  onClose?: () => void;
  [key: string]: unknown;
}>;

type LeftPanelViewKey = 'scriptPage' | 'workflowPage' | 'analysisList' | 'analysisNodeList' | 'analysisScriptStack' | 'analysisWorkflowStack' | 'sysFileBrowser' | 'projectReport' | 'projectLiterature' | 'projectReportLiteratureStack' | 'assayProjectPage' | 'agentSessionStack' | 'containerTemplateList' | 'containerTemplateStack';

const isLeftPanelViewKey = (key: string): key is LeftPanelViewKey =>
  key === 'scriptPage' || key === 'workflowPage' || key === 'analysisList' || key === 'analysisNodeList' || key === 'analysisScriptStack' || key === 'analysisWorkflowStack' || key === 'sysFileBrowser' || key === 'projectReport' || key === 'projectLiterature' || key === 'projectReportLiteratureStack' || key === 'assayProjectPage' || key === 'agentSessionStack' || key === 'containerTemplateList' || key === 'containerTemplateStack';

// 旧版活动栏 key 与合并后视图的映射：datasetFilePage / analysisNodeFilePage 已并入
// agentSessionStack 下半栏的数据集视图，
// analysisNodeList / scriptPage 已合并为上下堆叠的 analysisScriptStack，
// analysisList / workflowPage 已合并为上下堆叠的 analysisWorkflowStack，
// projectReport / projectLiterature 已合并为上下堆叠的 projectReportLiteratureStack，
// agentSessionList / datasetProjectPage 已合并为上下堆叠的 agentSessionStack。
const LEGACY_VIEW_KEY_MAP: Record<string, LeftPanelViewKey> = {
  // 数据集文件 / 分析节点文件已统一到 agentSessionStack 下半栏的数据集视图。
  datasetFilePage: 'agentSessionStack',
  analysisNodeFilePage: 'agentSessionStack',
  analysisNodeList: 'analysisScriptStack',
  scriptPage: 'analysisScriptStack',
  analysisList: 'analysisWorkflowStack',
  workflowPage: 'analysisWorkflowStack',
  // 项目报告与参考文献已合并为上下堆叠的 projectReportLiteratureStack。
  projectReport: 'projectReportLiteratureStack',
  projectLiterature: 'projectReportLiteratureStack',
  // 智能体会话与数据集已合并为上下堆叠的 agentSessionStack。
  agentSessionList: 'agentSessionStack',
  // 旧版「项目文件」入口已移除，持久化的旧 key 仍指向 agentSessionStack。
  projectFilePage: 'agentSessionStack',
  // 容器模板列表已合并为上下堆叠的 containerTemplateStack（应用会话 + 终端会话）。
  containerTemplateList: 'containerTemplateStack',
  // 应用会话已并入 containerTemplateStack 的上半栏，旧 key 兼容映射到堆叠视图。
  appSessionPage: 'containerTemplateStack',
};

const App: React.FC = () => {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const appTheme = useSelector((state: any) => state.user.theme);
  const leftActivityKey = useSelector((state: any) => state.user.leftActivityKey);
  const leftPanelWidth = useSelector((state: any) => state.user.leftPanelWidth);
  const leftMiddlePanelWidth = useSelector((state: any) => state.user.leftMiddlePanelWidth);
  const leftPanelCollapsed = useSelector((state: any) => state.user.leftPanelCollapsed);
  const layoutTheme: 'light' | 'dark' = appTheme === 'dark' ? 'dark' : 'light';
  const isDark = layoutTheme === 'dark';
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const [leftSideView, setLeftSideView] = useState<LeftPanelViewKey>(
    isLeftPanelViewKey(leftActivityKey) ? leftActivityKey : 'agentSessionStack',
  );
  const [leftWidthDraft, setLeftWidthDraft] = useState<number>(leftPanelWidth);
  // 左侧二级面板（leftMiddle）的当前内容：由左侧列表页通过 store 登记。
  const leftMiddlePane = useLeftMiddlePaneState();
  const [leftMiddleWidthDraft, setLeftMiddleWidthDraft] = useState<number>(leftMiddlePanelWidth);

  const leftActivityItems = useMemo(
    () => [
      {
        key: 'agentSessionStack',
        label: locale === 'en_US' ? 'Agent Sessions' : '智能体会话',
        icon: <CommentOutlined />,
      },
      // {
      //   key: 'assayProjectPage',
      //   label: locale === 'en_US' ? 'Assays' : '实验/建库',
      //   icon: <ExperimentOutlined />,
      // },
      {
        key: 'analysisScriptStack',
        label: locale === 'en_US' ? 'Nodes & Scripts' : '节点与脚本',
        icon: <CodeOutlined />,
      },
      {
        key: 'analysisWorkflowStack',
        label: locale === 'en_US' ? 'Analyses & Workflows' : '分析与流程',
        icon: <DeploymentUnitOutlined />,
      },

      // 项目报告与参考文献已合并为上下堆叠的 projectReportLiteratureStack。
      {
        key: 'projectReportLiteratureStack',
        label: locale === 'en_US' ? 'Reports & Literature' : '报告与文献',
        icon: <FileTextOutlined />,
      },
      // {
      //   key: 'sysFileBrowser',
      //   label: locale === 'en_US' ? 'System Files' : '系统文件',
      //   icon: <FolderOpenOutlined />,
      // },
      {
        key: 'containerTemplateStack',
        label: locale === 'en_US' ? 'Container Templates' : '容器模板',
        icon: <AppstoreOutlined />,
      },

    ],
    [locale],
  );

  useEffect(() => {
    setLeftWidthDraft(leftPanelWidth);
  }, [leftPanelWidth]);

  useEffect(() => {
    setLeftMiddleWidthDraft(leftMiddlePanelWidth);
  }, [leftMiddlePanelWidth]);

  useEffect(() => {
    if (!leftActivityKey) {
      return;
    }
    const hasMatchedItem = leftActivityItems.some((item) => item.key === leftActivityKey);
    if (hasMatchedItem) {
      setLeftSideView(leftActivityKey);
      return;
    }

    // 兼容历史缓存：旧 key 映射到合并后的视图。
    const legacyView = LEGACY_VIEW_KEY_MAP[leftActivityKey];
    if (legacyView) {
      setLeftSideView(legacyView);
      dispatch(setUserItem({ leftActivityKey: legacyView }));
      return;
    }

    const fallbackView: LeftPanelViewKey = 'agentSessionStack';
    setLeftSideView(fallbackView);
    dispatch(setUserItem({ leftActivityKey: fallbackView }));
  }, [dispatch, leftActivityItems, leftActivityKey]);

  const currentYear = new Date().getFullYear();
  // 底部面板在布局层（始终挂载）回填，不依赖 BottomPanel 是否已渲染。
  const userId = useSelector((state: any) => state.user.userInfo?.id as string | undefined);
  // 菜单配置是项目维度的：切换激活项目后需要按新项目重新回填。
  const projectId = useSelector((state: any) => state.user.projectId as string | undefined);
  const savedBottomPanel = useSelector((state: any) => state.user.userInfo?.menu_config?.bottom);
  useEffect(() => {
    hydrateBottomPanel(userId, projectId, savedBottomPanel);
  }, [userId, projectId, savedBottomPanel]);
  const layoutLocale: LayoutLocale = locale === 'en_US' ? 'en_US' : 'zh_CN';
  // 「容器运行时」安装向导入口只在后端 container.docker.provision.enabled=true 时出现，
  // 该开关随 /container/runtime/info 一起返回并保存在 redux 的 runtimeInfo 中。
  const provisionEnabled = useSelector(
    (state: any) => state.user.runtimeInfo?.provision_enabled === true,
  );
  const settingsMenuItems = useMemo(
    () =>
      buildLayoutMenus(
        layoutLocale,
        (item) => item.key !== '/container-runtime-provision' || provisionEnabled,
      ),
    [layoutLocale, provisionEnabled],
  );

  return (
    <Layout className={`layout-sharp ${isDark ? 'layout-sharp-dark' : 'layout-sharp-light'}`}>
      <AppHeader backgroundColor={colorBgContainer} />
      <Layout className="layout-sharp-main">
        <Sider
          width={56}
          collapsedWidth={56}
          theme={layoutTheme}
          className="layout-sharp-sider"
        >
          <ActivityBar
            items={leftActivityItems}
            activeKey={leftSideView}
            onChange={(key) => {
              if (!isLeftPanelViewKey(key)) {
                return;
              }
              setLeftSideView(key);
              // 折叠状态下点击活动栏图标，直接展开左侧面板
              dispatch(
                setUserItem({
                  leftActivityKey: key,
                  ...(leftPanelCollapsed ? { leftPanelCollapsed: false } : {}),
                }),
              );
            }}
          />
          <div className="layout-activitybar-settings">
            <Dropdown
              trigger={['hover']}
              placement="topLeft"
              menu={{
                items: settingsMenuItems,
                onClick: ({ key }) => navigate(String(key)),
              }}
            >
              <button
                type="button"
                className="layout-activitybar-btn"
                title={locale === 'en_US' ? 'Settings' : '设置'}
                aria-label={locale === 'en_US' ? 'Settings' : '设置'}
              >
                <span className="layout-activitybar-icon">
                  <SettingOutlined />
                </span>
              </button>
            </Dropdown>
          </div>
        </Sider>
        <Layout className="layout-sharp-main">
          <Content className="layout-sharp-content">
            <div
              className="layout-sharp-content-inner"
              style={{ background: colorBgContainer }}
            >
              <SplitWorkspace
                leftResizeLabel={locale === 'en_US' ? 'Resize left panel' : '调整左侧面板'}
                leftCollapsed={Boolean(leftPanelCollapsed)}
                onLeftCollapsedChange={(collapsed) =>
                  dispatch(setUserItem({ leftPanelCollapsed: collapsed }))
                }
                leftCollapseLabel={locale === 'en_US' ? 'Hide left panel' : '隐藏左侧面板'}
                leftExpandLabel={locale === 'en_US' ? 'Show left panel' : '显示左侧面板'}
                leftWidth={leftWidthDraft}
                onLeftWidthChange={setLeftWidthDraft}
                onLeftWidthCommit={(width) => dispatch(setUserItem({ leftPanelWidth: width }))}
                left={<ViewResolver view={leftSideView} view_mode="card" />}
                leftMiddle={
                  leftMiddlePane ? (
                    <LeftMiddlePaneView
                      view={leftMiddlePane.view}
                      {...(leftMiddlePane.params ?? {})}
                      onClose={() => closeLeftMiddlePane()}
                    />
                  ) : undefined
                }
                leftMiddleResizeLabel={
                  locale === 'en_US' ? 'Resize report items panel' : '调整条目面板'
                }
                leftMiddleWidth={leftMiddleWidthDraft}
                onLeftMiddleWidthChange={setLeftMiddleWidthDraft}
                onLeftMiddleWidthCommit={(width) =>
                  dispatch(setUserItem({ leftMiddlePanelWidth: width }))
                }
                main={
                  <div className="layout-sharp-main-stack">
                    {/* 常规路由直接在 main 的 <Outlet /> 中渲染；
                        标签栏（MainTabs）只属于 /session/:sessionId 的工作区，不再在布局层处理。 */}
                    <div className="layout-sharp-main-outlet">
                      <Outlet />
                    </div>
                    <BottomPanel />
                  </div>
                }
              />
            </div>
          </Content>
        </Layout>
      </Layout>
      <Footer className="layout-sharp-footer">
        <div className="layout-sharp-footer-left">
          <span>Brave ©{currentYear}</span>
          <a className="layout-sharp-footer-link" href="https://github.com/biox-dev/gobrave" target="_blank" rel="noreferrer">
            Source Code
          </a>
          <span className="layout-sharp-footer-separator">|</span>
          <a className="layout-sharp-footer-link" href="https://biox-dev.github.io/gobrave-doc/" target="_blank" rel="noreferrer">
            Project Docs
          </a>
        </div>
        <div className="layout-sharp-footer-right">
          {/* 默认容器运行时状态：悬停展示连接信息，点击重新检测。 */}
          <RuntimeStatus />
          <ContainerQueueMonitor />
          
        </div>
      </Footer>
    </Layout>
  );
};

export default App;