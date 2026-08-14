import { FC } from "react"
import RenderRouter from './routes';
import { HashRouter } from "react-router";
import { useI18n } from "./hooks/useI18n";
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { ConfigProvider, theme as antdTheme } from 'antd';
import { useSelector } from "react-redux";
import { setupGlobalMessage, useGlobalMessage } from "./hooks/useGlobalMessage";
import { setupGlobalNotification } from "./hooks/useGlobalNotification";
import axios from "axios";
import { getPathname } from "./utils/utils";
import LLMBootstrap from "./event-bus/LLMBootstrap";
import { RenderProvider } from "./context/render/RenderProvider";
import "@/core/component-registry/module-auto-loader";
import { SideViewProvider } from "./context/side/SideViewContext";
import { UIContainer } from "@/core/ui-system/UIContainer";
import { setupLegacyAxios401Interceptor } from "@/api/client/http";

setupLegacyAxios401Interceptor();

// registerLLMActions();
const App: FC<any> = () => {
  const { locale } = useI18n()
  const antdLocale = locale === 'zh_CN' ? zhCN : enUS
  const { theme, network } = useSelector((state: any) => state.user) //light dark
  const isDark = theme === 'dark'
  const messageHolder = setupGlobalMessage();
  const notificationHolder = setupGlobalNotification()

  const message = useGlobalMessage();

  const baseURL = localStorage.getItem('baseURL') || getPathname()
  axios.defaults.baseURL = `${baseURL}/brave-api`;
  const authorization = localStorage.getItem('Authorization')
  if (authorization) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${authorization}`;

  }
  axios.defaults.timeout = 20000;

  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      // console.log(error)

      if (error.response) {

        const { status, data } = error.response;
        switch (status) {
          case 401:
            window.location.hash = "/login";
            break;
          default:
            if (network == "CONNECT") {
              // debugger
              // console.error("HTTP Error:", status);
              // console.error(data?.detail)
              message.error(data?.detail)
            } else if (network == "NOT_CONNECT") {
              // message.error("NOT_CONNECT")
            } else {
              // message.error("UNKNOW")
            }

        }
      } else {
        console.error("网络异常:", error.message);
      }
      return Promise.reject(error);
    }
  );
  // const themeConfig =
  //   theme === 'dark'
  //     ? antdTheme.defaultAlgorithm
  //     : antdTheme.defaultAlgorithm;
  return <>
    {/* <Suspense fallback={<Skeleton active></Skeleton>}>
 
    </Suspense> */}
    {messageHolder}
    {notificationHolder}
    <ConfigProvider
      theme={{
        algorithm:
          isDark
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        token: {
          borderRadius: 0,
          borderRadiusLG: 0,
          borderRadiusSM: 0,
          wireframe: true,
          colorBorder: isDark ? '#2f3442' : '#d7dbe2',
          colorSplit: isDark ? '#2f3442' : '#d7dbe2',
          colorBgLayout: isDark ? '#151922' : '#f3f5f8',
          colorBgContainer: isDark ? '#1b2230' : '#ffffff',
        },
        components: {
          Layout: {
            headerBg: isDark ? '#1b2230' : '#ffffff',
            siderBg: isDark ? '#171d29' : '#f8fafc',
            bodyBg: isDark ? '#151922' : '#f3f5f8',
            footerBg: isDark ? '#1b2230' : '#ffffff',
          },
          Menu: {
            itemBorderRadius: 0,
            subMenuItemBorderRadius: 0,
            colorItemBgSelected: isDark ? '#212a3a' : '#eaf1fb',
            colorItemTextSelected: isDark ? '#dbe6ff' : '#1b1f27',
            itemMarginInline: 0,
          },
          Button: {
            borderRadius: 0,
          },
          Card: {
            borderRadiusLG: 0,
          },
          Input: {
            borderRadius: 0,
          },
          Select: {
            borderRadius: 0,
            optionSelectedBg: isDark ? '#212a3a' : '#eaf1fb',
          },
          Dropdown: {
            borderRadius: 0,
          },
          Tabs: {
            verticalItemPadding: "0 0",
            itemSelectedColor: isDark ? '#dbe6ff' : '#1b1f27',
          }
        }
      }}
      locale={antdLocale}>
      <HashRouter>
        <LLMBootstrap />
        <SideViewProvider>
          <RenderProvider>

            <RenderRouter></RenderRouter>
            <UIContainer />

          </RenderProvider>
        </SideViewProvider>



      </HashRouter>

    </ConfigProvider>

  </>
}

export default App
