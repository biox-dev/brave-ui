import { useEffect } from "react";
import { useNavigate } from "react-router";
import { sseClient } from "@/sse";
import { useRouterStore } from "@/event-bus/stores/router";
import { useUIStore } from "@/event-bus/stores/ui";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { useGlobalNotification } from "@/hooks/useGlobalNotification";
import { registerLLMActions } from "./registerHandlers";

export default function LLMBootstrap() {
  const navigate = useNavigate();
  const messageApi = useGlobalMessage();
  const notificationApi = useGlobalNotification();
  const setNavigate = useRouterStore((state) => state.setNavigate);
  const setMessageApi = useUIStore((state) => state.setMessageApi);
  const setNotificationApi = useUIStore((state) => state.setNotificationApi);

  useEffect(() => {
    setNavigate(navigate);
  }, [navigate, setNavigate]);

  useEffect(() => {
    setMessageApi(messageApi);
    setNotificationApi(notificationApi);
  }, [messageApi, notificationApi, setMessageApi, setNotificationApi]);

  useEffect(() => {
    const cleanup = registerLLMActions(sseClient);
    return cleanup;
  }, []);

  return null;
}
