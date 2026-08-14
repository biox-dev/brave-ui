// SideViewContext.tsx
import React, { createContext, FC, useCallback, useContext, useState } from 'react';
import { useLocation } from 'react-router';

export type LeftPaneMode = 'placeholder' | 'content';

const SideViewContext = createContext<any>(null);

export const SideViewProvider:FC<any> = ({ children }) => {
  const location = useLocation();

  const [viewMap, setViewMap] = useState<Record<string, string | null>>({});
  const [sideOptions, setSideOptions] = useState<any>([]);
  const [leftPane, setLeftPane] = useState<React.ReactNode>(null);
  const [leftPaneMode, setLeftPaneMode] = useState<LeftPaneMode>('placeholder');

  const setSideView = (view: string | null) => {
    setViewMap(prev => ({
      ...prev,
      [location.pathname]: view,
    }));
  };

  const sideView = viewMap[location.pathname] ?? "llm-card";  // 默认

  const setLeftPaneContent = useCallback((content: React.ReactNode) => {
    setLeftPane(content);
    setLeftPaneMode('content');
  }, []);

  const clearLeftPane = useCallback(() => {
    setLeftPane(null);
    setLeftPaneMode('placeholder');
  }, []);

  return (
    <SideViewContext.Provider value={{
      viewMap, setSideView, sideView, sideOptions, setSideOptions,
      leftPane, leftPaneMode, setLeftPaneContent, clearLeftPane,
    }}>
      {children}
    </SideViewContext.Provider>
  );
};

// export const useSideViewContext = () => useContext(SideViewContext);
export const useSideViewContext = () => {
  const ctx = useContext(SideViewContext);
  if (!ctx) throw new Error("useSideViewContext must be used within <SideViewProvider>");
  return ctx;
};
