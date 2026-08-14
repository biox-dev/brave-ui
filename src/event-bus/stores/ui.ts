import { create } from "zustand";
import type { MessageInstance } from "antd/es/message/interface";
import type { NotificationInstance } from "antd/es/notification/interface";

type UIState = {
  messageApi: MessageInstance | null;
  notificationApi: NotificationInstance | null;
  setMessageApi: (api: MessageInstance) => void;
  setNotificationApi: (api: NotificationInstance) => void;
};

export const useUIStore = create<UIState>((set) => ({
  messageApi: null,
  notificationApi: null,
  setMessageApi: (api) => set({ messageApi: api }),
  setNotificationApi: (api) => set({ notificationApi: api }),
}));