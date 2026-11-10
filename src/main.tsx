import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router'
import axios from 'axios';
import store from './store'
import { Provider } from 'react-redux'
import { ConfigProvider, message } from 'antd'
import { SSEProvider } from './context/sse/SSEProvider.tsx'
import { useGlobalMessage } from './hooks/useGlobalMessage.ts'
import { RenderProvider } from './context/render/RenderProvider.tsx'
import { RegistryProvider } from './core/component-registry/registry-context.tsx'
import { QueryClient, QueryClientProvider } from 'react-query'
import { installDesktopWindowBridge } from './core/desktop/openWindow.ts'

console.log(import.meta.env.MODE)

// 桌面端（Wails）接管 window.open / <a target="_blank"> 的白名单入口，
// 让「打开应用」变成原生窗口；浏览器端该调用直接返回，不改变行为。
installDesktopWindowBridge()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      keepPreviousData: true,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  // <StrictMode>

  // </StrictMode>
  // <ConfigProvider>
  <QueryClientProvider client={queryClient}>
    <Provider store={store}>
      <SSEProvider>
        <RegistryProvider>
          <App />
        </RegistryProvider>
      </SSEProvider>
    </Provider>
  </QueryClientProvider>
  // </ConfigProvider>



)
