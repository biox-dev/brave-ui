import { FC } from "react"
import RenderRouter from './routes';
import { HashRouter } from "react-router";
import { useI18n } from "./hooks/useI18n";
import zhCN from 'antd/locale/zh_CN'
import enUS from 'antd/locale/en_US'
import { ConfigProvider, theme as antdTheme, Button } from 'antd';
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
  const { locale, t } = useI18n()
  const antdLocale = locale === 'zh_CN' ? zhCN : enUS
  const { theme, network } = useSelector((state: any) => state.user) //light dark
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
          theme === 'dark'
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        components: {
          Tabs: {
            /* 这里是你的组件 token */
            verticalItemPadding: "0 0",
            // cardBg:"red"
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
