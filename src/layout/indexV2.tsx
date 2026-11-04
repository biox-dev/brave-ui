import React, { useEffect, useMemo, useState } from 'react';
import { ApartmentOutlined, AppstoreOutlined, BookOutlined, SettingOutlined, FolderOpenOutlined, NodeIndexOutlined, BarChartOutlined, ExperimentOutlined, CodeOutlined, ContainerOutlined, ControlOutlined } from '@ant-design/icons';
import { Button, Dropdown, Flex, Layout, Segmented, theme, Tooltip } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '@/hooks/useI18n';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import BorderlessCard from '@/components/common/borderless-card';
import ContainerQueueMonitor from '@/components/container-manager/container-monitor';
import { setUserItem } from '@/store/userSlice';
import { buildLayoutMenus, type LayoutLocale } from './layout-menu';
import AppHeader from './components/AppHeader';
import ActivityBar from './components/ActivityBar';
import SplitWorkspace from './components/SplitWorkspace.tsx';
import MainTabs from './components/MainTabs';
import BottomPanel from './components/BottomPanel';
import { hydrateBottomPanel, useBottomPanelStore } from './bottom-panel-store';
import { invoke } from '@/core/ui-system/invokeV2';
import './indexV2.css';

const { Content, Footer, Sider } = Layout;
type LeftPanelViewKey = 'scriptPage' | 'workflowPage' | 'analysisList' | 'analysisNodeList' | 'analysisScriptStack' | 'analysisWorkflowStack' | 'sysFileBrowser' | 'projectReport' | 'projectLiterature' | 'assayProjectPage' | 'projectFilePage' | 'containerTemplateList' | 'containerTemplateStack';

const isLeftPanelViewKey = (key: string): key is LeftPanelViewKey =>
  key === 'scriptPage' || key === 'workflowPage' || key === 'analysisList' || key === 'analysisNodeList' || key === 'analysisScriptStack' || key === 'analysisWorkflowStack' || key === 'sysFileBrowser' || key === 'projectReport' || key === 'projectLiterature' || key === 'assayProjectPage' || key === 'projectFilePage' || key === 'containerTemplateList' || key === 'containerTemplateStack';

// 旧版活动栏 key 与合并后视图的映射：datasetFilePage / analysisNodeFilePage 已合并为 projectFilePage，
// analysisNodeList / scriptPage 已合并为上下堆叠的 analysisScriptStack，
// analysisList / workflowPage 已合并为上下堆叠的 analysisWorkflowStack。
const LEGACY_VIEW_KEY_MAP: Record<string, LeftPanelViewKey> = {
  datasetFilePage: 'projectFilePage',
  analysisNodeFilePage: 'projectFilePage',
  analysisNodeList: 'analysisScriptStack',
  scriptPage: 'analysisScriptStack',
  analysisList: 'analysisWorkflowStack',
  workflowPage: 'analysisWorkflowStack',
  // 容器模板列表已合并为上下堆叠的 containerTemplateStack（应用会话 + 终端会话）。
  containerTemplateList: 'containerTemplateStack',
  // 应用会话已并入 containerTemplateStack 的上半栏，旧 key 兼容映射到堆叠视图。
  appSessionPage: 'containerTemplateStack',
};

const App: React.FC = () => {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  const appTheme = useSelector((state: any) => state.user.theme);
  const leftActivityKey = useSelector((state: any) => state.user.leftActivityKey);
  const leftPanelWidth = useSelector((state: any) => state.user.leftPanelWidth);
  const rightPanelWidth = useSelector((state: any) => state.user.rightPanelWidth);
  const leftPanelCollapsed = useSelector((state: any) => state.user.leftPanelCollapsed);
  const layoutTheme: 'light' | 'dark' = appTheme === 'dark' ? 'dark' : 'light';
  const isDark = layoutTheme === 'dark';
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const sideView = useSelector((state: any) => state.user.sideView);
  const [leftSideView, setLeftSideView] = useState<LeftPanelViewKey>(
    isLeftPanelViewKey(leftActivityKey) ? leftActivityKey : 'sysFileBrowser',
  );
  const [leftWidthDraft, setLeftWidthDraft] = useState<number>(leftPanelWidth);
  const [rightWidthDraft, setRightWidthDraft] = useState<number>(rightPanelWidth);

  const leftActivityItems = useMemo(
    () => [
      {
        key: 'projectFilePage',
        label: locale === 'en_US' ? 'Project Files' : '项目文件',
        icon: <FolderOpenOutlined />,
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
        icon: <ApartmentOutlined />,
      },{
        key: 'containerTemplateStack',
        label: locale === 'en_US' ? 'Container Templates' : '容器模板',
        icon: <ContainerOutlined />,
      },

      {
        key: 'projectReport',
        label: locale === 'en_US' ? 'Project Report' : '项目报告',
        icon: <BarChartOutlined />,
      },
      // {
      //   key: 'sysFileBrowser',
      //   label: locale === 'en_US' ? 'System Files' : '系统文件',
      //   icon: <FolderOpenOutlined />,
      // },

      {
        key: 'projectLiterature',
        label: locale === 'en_US' ? 'Literature' : '参考文献',
        icon: <BookOutlined />,
      },  

    ],
    [locale],
  );

  useEffect(() => {
    setLeftWidthDraft(leftPanelWidth);
  }, [leftPanelWidth]);

  useEffect(() => {
    setRightWidthDraft(rightPanelWidth);
  }, [rightPanelWidth]);

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

    const fallbackView: LeftPanelViewKey = 'sysFileBrowser';
    setLeftSideView(fallbackView);
    dispatch(setUserItem({ leftActivityKey: fallbackView }));
  }, [dispatch, leftActivityItems, leftActivityKey]);

  const currentYear = new Date().getFullYear();
  // 根路由：主区域不渲染 <Outlet />，只有标签栏有意义。
  const normalizedPath = pathname.replace(/\/+$/, '');
  const isRootRoute = normalizedPath === '' || normalizedPath === '/';
  // 直接从 redux 读取已落库的标签页（由 /auth/me 回填），不依赖 MainTabs 是否已挂载，
  // 否则 main 为 null 时 MainTabs 不渲染 → 永远拿不到数据 → 死锁。
  const savedTabs = useSelector((state: any) => state.user.userInfo?.menu_config?.tabs as
    | Array<{ url?: string }>
    | undefined);
  const hasSavedTabs = Boolean(
    savedTabs?.some((tab) => tab.url && tab.url !== '/'),
  );
  // 底部面板同理：在布局层（始终挂载）回填，不依赖 BottomPanel 是否已渲染。
  const userId = useSelector((state: any) => state.user.userInfo?.id as string | undefined);
  const savedBottomPanel = useSelector((state: any) => state.user.userInfo?.menu_config?.bottom);
  useEffect(() => {
    hydrateBottomPanel(userId, savedBottomPanel);
  }, [userId, savedBottomPanel]);
  // 只订阅布尔值：底部面板拖动高度会高频更新 store，整页布局不需要跟着重渲染。
  const hasBottomTabs = useBottomPanelStore((state) => state.tabs.length > 0);  // 根路由且后端还没有任何标签时，主区域收收让右侧撑满；
  // 一旦标签数据回填、底部面板打开了标签（如容器终端）或路由离开根路径，主区域自动打开。
  const hideMainPane = isRootRoute && !hasSavedTabs && !hasBottomTabs;
  const layoutLocale: LayoutLocale = locale === 'en_US' ? 'en_US' : 'zh_CN';
  const segmentedOptions = useMemo(
    () =>
      // sideOptions && sideOptions.length > 0
      //   ? sideOptions
      //   : [{ label: locale === 'en_US' ? 'Assistant' : '助手', value: 'llm-card' },
      //     { label: locale === 'en_US' ? 'App' : '应用', value: 'appSessionPage' },
      //     ...sideOptions
      //   ],
      [{ label: locale === 'en_US' ? 'Assistant' : '助手', value: 'agentChat' },
      { label: locale === 'en_US' ? 'Parameters' : '参数', value: 'editParamsPanel' },
        // ...sideOptions
      ],
    [],
  );
  const settingsMenuItems = useMemo(() => buildLayoutMenus(layoutLocale), [layoutLocale]);

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
                rightResizeLabel={locale === 'en_US' ? 'Resize right panel' : '调整右侧面板'}
                leftCollapsed={Boolean(leftPanelCollapsed)}
                onLeftCollapsedChange={(collapsed) =>
                  dispatch(setUserItem({ leftPanelCollapsed: collapsed }))
                }
                leftCollapseLabel={locale === 'en_US' ? 'Hide left panel' : '隐藏左侧面板'}
                leftExpandLabel={locale === 'en_US' ? 'Show left panel' : '显示左侧面板'}
                leftWidth={leftWidthDraft}
                rightWidth={rightWidthDraft}
                onLeftWidthChange={setLeftWidthDraft}
                onRightWidthChange={setRightWidthDraft}
                onLeftWidthCommit={(width) => dispatch(setUserItem({ leftPanelWidth: width }))}
                onRightWidthCommit={(width) => dispatch(setUserItem({ rightPanelWidth: width }))}
                left={<ViewResolver view={leftSideView} view_mode="card" />}
                main={
                  hideMainPane ? null : (
                    <div className="layout-sharp-main-stack">
                      <BorderlessCard
                        size="small"
                        className="layout-sharp-main-card"
                        styles={{ body: { padding: 8 } }}
                        title={<MainTabs />}
                      >
                        {isRootRoute ? (
                          <div className="layout-sharp-main-empty">
                            {locale === 'en_US'
                              ? 'Select a tab above to continue'
                              : '请选择一个标签页继续'}
                          </div>
                        ) : (
                          <Outlet />
                        )}
                      </BorderlessCard>
                      <BottomPanel />
                    </div>
                  )
                }
                expandRight={hideMainPane}
                right={

                  <BorderlessCard
                    size="small"
                    styles={{ body: { padding: 8 } }}
                    extra={
                      <Flex align="center" gap={8}>
                        {/* <Tooltip
                          title={locale === 'en_US' ? 'Open parameters in drawer' : '在抽屉中打开参数'}
                        >
                          <Button
                            size="small"
                            type="text"
                            icon={<ControlOutlined />}
                            aria-label={locale === 'en_US' ? 'Parameters' : '参数'}
                            onClick={() =>
                              invoke.editParamsPanel.drawer(
                                {},
                                {
                                  title: locale === 'en_US' ? 'Parameters' : '参数',
                                  width: 520,
                                  placement: 'right',
                                },
                              )
                            }
                          />
                        </Tooltip> */}
                        <Segmented
                          size="small"
                          value={sideView}
                          options={segmentedOptions}
                          onChange={(value) => dispatch(setUserItem({ sideView: value as string }))}
                        />
                      </Flex>
                    }
                  >
                    <ViewResolver view={sideView} view_mode="card" />
                  </BorderlessCard>
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
          <ContainerQueueMonitor />
        </div>
      </Footer>
    </Layout>
  );
};

export default App;