import React, { useEffect, useMemo, useState } from 'react';
import { ApartmentOutlined, FileTextOutlined, SettingOutlined, FileSearchOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { Dropdown, Layout, Segmented, theme } from 'antd';
import { Outlet, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '@/hooks/useI18n';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import BorderlessCard from '@/components/common/borderless-card';
import { useSideViewContext } from '@/context/side/SideViewContext';
import ContainerQueueMonitor from '@/components/container-manager/container-monitor';
import { setUserItem } from '@/store/userSlice';
import { buildLayoutMenus, type LayoutLocale } from './layout-menu';
import AppHeader from './components/AppHeader';
import ActivityBar from './components/ActivityBar';
import SplitWorkspace from './components/SplitWorkspace.tsx';
import './indexV2.css';

const { Content, Footer, Sider } = Layout;
type LeftPanelViewKey = 'scriptPageLeftPanel' | 'workflowPageLeftPanel' | 'analysisTree' | 'sysFileBrowser';

const isLeftPanelViewKey = (key: string): key is LeftPanelViewKey =>
  key === 'scriptPageLeftPanel' || key === 'workflowPageLeftPanel' || key === 'analysisTree' || key === 'sysFileBrowser';

const App: React.FC = () => {
  const { locale } = useI18n();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const appTheme = useSelector((state: any) => state.user.theme);
  const leftActivityKey = useSelector((state: any) => state.user.leftActivityKey);
  const leftPanelWidth = useSelector((state: any) => state.user.leftPanelWidth);
  const rightPanelWidth = useSelector((state: any) => state.user.rightPanelWidth);
  const layoutTheme: 'light' | 'dark' = appTheme === 'dark' ? 'dark' : 'light';
  const isDark = layoutTheme === 'dark';
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const { sideView, setSideView, sideOptions } = useSideViewContext();
  const [leftSideView, setLeftSideView] = useState<LeftPanelViewKey>(
    isLeftPanelViewKey(leftActivityKey) ? leftActivityKey : 'sysFileBrowser',
  );
  const [leftWidthDraft, setLeftWidthDraft] = useState<number>(leftPanelWidth);
  const [rightWidthDraft, setRightWidthDraft] = useState<number>(rightPanelWidth);

  const leftActivityItems = useMemo(
    () => [
      {
        key: 'sysFileBrowser',
        label: locale === 'en_US' ? 'System Files' : '系统文件',
        icon: <FolderOpenOutlined />,
      }, {
        key: 'scriptPageLeftPanel',
        label: locale === 'en_US' ? 'Script Page' : '脚本页',
        icon: <FileTextOutlined />,
      },
      {
        key: 'workflowPageLeftPanel',
        label: locale === 'en_US' ? 'Workflow Page' : '流程页',
        icon: <ApartmentOutlined />,
      },
      {
        key: 'analysisTree',
        label: locale === 'en_US' ? 'Analysis Report' : '分析报告',
        icon: <FileSearchOutlined />,
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

    const fallbackView: LeftPanelViewKey = 'sysFileBrowser';
    setLeftSideView(fallbackView);
    dispatch(setUserItem({ leftActivityKey: fallbackView }));
  }, [dispatch, leftActivityItems, leftActivityKey]);

  const currentYear = new Date().getFullYear();
  const layoutLocale: LayoutLocale = locale === 'en_US' ? 'en_US' : 'zh_CN';
  const segmentedOptions = useMemo(
    () =>
      // sideOptions && sideOptions.length > 0
      //   ? sideOptions
      //   : [{ label: locale === 'en_US' ? 'Assistant' : '助手', value: 'llm-card' },
      //     { label: locale === 'en_US' ? 'App' : '应用', value: 'appSessionPage' },
      //     ...sideOptions
      //   ],
      [{ label: locale === 'en_US' ? 'Assistant' : '助手', value: 'llm-card' },
      { label: locale === 'en_US' ? 'App' : '应用', value: 'appSessionPage' },
      ...sideOptions
      ],
    [sideOptions, locale],
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
              dispatch(setUserItem({ leftActivityKey: key }));
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
                leftWidth={leftWidthDraft}
                rightWidth={rightWidthDraft}
                onLeftWidthChange={setLeftWidthDraft}
                onRightWidthChange={setRightWidthDraft}
                onLeftWidthCommit={(width) => dispatch(setUserItem({ leftPanelWidth: width }))}
                onRightWidthCommit={(width) => dispatch(setUserItem({ rightPanelWidth: width }))}
                left={<ViewResolver view={leftSideView} view_mode="card" />}
                main={<Outlet />}
                right={

                  <BorderlessCard
                    size="small"
                    styles={{ body: { padding: 8 } }}
                    extra={
                      <Segmented
                        size="small"
                        value={sideView}
                        options={segmentedOptions}
                        onChange={(value) => setSideView(value as string)}
                      />
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
          <a className="layout-sharp-footer-link" href="https://github.com/gobravedev/gobrave" target="_blank" rel="noreferrer">
            Source Code
          </a>
          <span className="layout-sharp-footer-separator">|</span>
          <a className="layout-sharp-footer-link" href="https://gobravedev.github.io/gobrave-doc/" target="_blank" rel="noreferrer">
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