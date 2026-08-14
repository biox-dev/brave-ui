import React, { useEffect, useMemo, useState } from 'react';
import { Card, Layout, Menu, Segmented, Typography, theme } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { useDispatch, useSelector } from 'react-redux';
import { useI18n } from '@/hooks/useI18n';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useSideViewContext } from '@/context/side/SideViewContext';
import ContainerQueueMonitor from '@/components/container-manager/container-monitor';
import { setUserItem } from '@/store/userSlice';
import { buildLayoutMenus, buildSelectedKeyMap, layoutMenuTree, resolveSelectedKey } from './layout-menu';
import AppHeader from './components/AppHeader';
import SplitWorkspace from './components/SplitWorkspace.tsx';
import './indexV2.css';

const { Content, Footer, Sider } = Layout;

const App: React.FC = () => {
  const { locale } = useI18n();
  const dispatch = useDispatch();
  const appTheme = useSelector((state: any) => state.user.theme);
  const leftPanelWidth = useSelector((state: any) => state.user.leftPanelWidth);
  const rightPanelWidth = useSelector((state: any) => state.user.rightPanelWidth);
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = appTheme === 'dark';
  const {
    token: { colorBgContainer },
  } = theme.useToken();
  const { sideView, setSideView, sideOptions } = useSideViewContext();
  const [leftWidthDraft, setLeftWidthDraft] = useState<number>(leftPanelWidth);
  const [rightWidthDraft, setRightWidthDraft] = useState<number>(rightPanelWidth);

  useEffect(() => {
    setLeftWidthDraft(leftPanelWidth);
  }, [leftPanelWidth]);

  useEffect(() => {
    setRightWidthDraft(rightPanelWidth);
  }, [rightPanelWidth]);

  const menuItems = useMemo(
    () => buildLayoutMenus(locale === 'en_US' ? 'en_US' : 'zh_CN'),
    [locale],
  );
  const selectedKeyMap = useMemo(() => buildSelectedKeyMap(layoutMenuTree), []);
  const selectedKey = useMemo(
    () => resolveSelectedKey(location.pathname, selectedKeyMap),
    [location.pathname, selectedKeyMap],
  );

  const currentYear = new Date().getFullYear();
  const segmentedOptions = useMemo(
    () =>
      sideOptions && sideOptions.length > 0
        ? sideOptions
        : [{ label: locale === 'en_US' ? 'Assistant' : '助手', value: 'llm-card' }],
    [sideOptions, locale],
  );

  return (
    <Layout className={`layout-sharp ${isDark ? 'layout-sharp-dark' : 'layout-sharp-light'}`}>
      <Sider
        trigger={null}
        collapsible
        collapsed
        theme={isDark ? 'dark' : 'light'}
        className="layout-sharp-sider"
      >
        <div className="layout-sharp-brand">
          <Typography.Text strong className="layout-sharp-brand-text">BRAVE</Typography.Text>
        </div>
        <Menu
          className="layout-sharp-menu"
          theme={isDark ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout className="layout-sharp-main">
        <AppHeader backgroundColor={colorBgContainer} />
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
              left={
                <Card
                  size="small"
                  className="layout-sharp-side-card"
                  styles={{ body: { padding: 8 } }}
                >
                  <div className="layout-sharp-side-card-placeholder">
                    {locale === 'en_US' ? 'Right Panel Reserved' : '右侧面板预留'}
                  </div>
                </Card>
              }
              main={<Outlet />}
              right={

                <Card
                  size="small"
                  className="layout-sharp-side-card"
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
                  <div className="layout-sharp-side-card-body">
                    <ViewResolver view={sideView} view_mode="card" />
                  </div>
                </Card>
              }
            />
          </div>
        </Content>
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
    </Layout>
  );
};

export default App;