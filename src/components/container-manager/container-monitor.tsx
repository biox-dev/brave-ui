import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Popover, Tooltip, Flex, Typography, Button } from 'antd';
import { ClockCircleOutlined, DeleteOutlined, ReloadOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { http } from '@/api/client/http';
import { cleanupAllContainersApi } from '@/api/container';
import { getGlobalMessage } from '@/hooks/useGlobalMessage';
import { useComponentStore } from '@/event-bus/stores/components';

/**
 * 后端容器集合变化事件在前端的组件类目 / 方法名。
 *
 * 对应 manager.ContainerManager.broadcastContainerChanged：容器创建 / 删除时
 * 后端以 `component.invoke`（category=container-queue, id=*, method=containerChanged）
 * 广播给所有在线客户端，这里收到后重新拉一次队列状态。
 */
const CONTAINER_QUEUE_CATEGORY = 'container-queue';

/** 会话面板 / 徽标共用的注册 ID（后端推的是 "*"，store 会分发到所有实例）。 */
const CONTAINER_QUEUE_ID = '*';

interface QueueStatus {
    active_count: number;
    pending_count: number;
    max_concurrency: number;
    max_pending: number;
    queue_enabled: boolean;
}

/**
 * 容器队列状态指示器 + 清理入口。
 *
 * - 鼠标移上去：Popover 展示运行中 / 等待中 / 并发上限 / 排队上限等明细；
 * - 点击徽标：立即刷新一次队列状态（刷新时图标旋转）；
 * - 弹窗底部「清理全部容器」按钮：二次确认后调用 /container/instance/cleanup-all，
 *   删除全部容器（运行中 + 已停止）、网关路由与全部会话。
 */
const ContainerQueueMonitor: React.FC = () => {
    const [status, setStatus] = useState<QueueStatus | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const [cleaning, setCleaning] = useState(false);
    // confirming 是弹窗内「清理全部容器」的二次确认状态（inline 两步确认，
    // 避免在 hover 弹窗里再嵌套一个 Popconfirm 导致主弹窗提前关闭）。
    const [confirming, setConfirming] = useState(false);

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const resp = await http.get('/container/queue/status');
            setStatus(resp.data);
            setError(false);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    /**
     * 调用「清理全部容器资源」接口：
     * 删除所有容器实例（运行中 + 已停止）及其 docker / k8s 容器、网关路由与全部会话。
     *
     * 成功 / 失败提示统一走全局 message；请求失败的后端错误已由 http 拦截器弹出，
     * 这里只负责刷新一次队列状态。
     */
    const handleCleanup = useCallback(async () => {
        setCleaning(true);
        try {
            const resp = await cleanupAllContainersApi();
            const result = resp.data;
            const failed = result.errors?.length ?? 0;
            const summary = `已清理容器 ${result.containers_deleted}/${result.containers_total}，路由 ${result.gateway_routes_deleted} 条，会话 ${result.app_sessions_deleted} 个`;
            if (failed > 0) {
                getGlobalMessage()?.warning(`${summary}，${failed} 项失败`);
            } else {
                getGlobalMessage()?.success(summary);
            }
            await fetchStatus();
        } catch {
            // 后端错误已由 http 拦截器提示，这里无需重复。
        } finally {
            setCleaning(false);
            setConfirming(false);
        }
    }, [fetchStatus]);

    // 挂载时拉取一次。
    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    /**
     * 订阅后端广播的「容器集合变化」事件。
     *
     * 与 app-session 面板相同的模式：用 useComponentStore 注册当前实例，
     * 后端推送 component.invoke(container-queue, *, containerChanged) 时由 store
     * 回调到这里。事件只作为「该刷新了」的信号，参数（实例 ID / 状态）不参与计算，
     * 直接重拉队列状态。
     */
    const { register, unregister } = useComponentStore();
    const realtimeInstance = useMemo(
        () => ({
            // 后端广播的 method 名（与设备无关，仅表示「容器集合变了」）。
            containerChanged: () => {
                void fetchStatus();
            },
        }),
        [fetchStatus],
    );

    useEffect(() => {
        register(CONTAINER_QUEUE_CATEGORY, CONTAINER_QUEUE_ID, realtimeInstance);
        return () => {
            unregister(CONTAINER_QUEUE_CATEGORY, CONTAINER_QUEUE_ID, realtimeInstance);
        };
    }, [register, unregister, realtimeInstance]);

    if (error && !status) {
        return null;
    }

    if (!status || !status.queue_enabled) {
        return null;
    }

    const saturated = status.active_count >= status.max_concurrency;
    const activeColor = saturated ? '#ff4d4f' : '#52c41a';
    const pendingFull = status.pending_count >= status.max_pending;
    const pendingColor = pendingFull ? '#ff4d4f' : '#faad14';

    const handleClick = () => {
        setOpen(true);
        fetchStatus();
    };

    const detailRow = (label: string, value: React.ReactNode) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, lineHeight: '20px' }}>
            <span style={{ color: 'rgba(0,0,0,0.45)' }}>{label}</span>
            <span style={{ fontWeight: 500 }}>{value}</span>
        </div>
    );

    const content = (
        <div style={{ fontSize: 12, minWidth: 190 }}>
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                    color: 'rgba(0,0,0,0.45)',
                }}
            >
                <ThunderboltOutlined />
                <span>容器执行队列</span>
            </div>
            {detailRow(
                '运行中',
                <span style={{ color: activeColor }}>
                    {status.active_count} / {status.max_concurrency}
                </span>,
            )}
            {detailRow(
                '等待中',
                <span style={{ color: status.pending_count > 0 ? pendingColor : undefined }}>
                    {status.pending_count} / {status.max_pending}
                </span>,
            )}
            {detailRow('并发上限', status.max_concurrency)}
            {detailRow('排队上限', status.max_pending)}
            {detailRow(
                '状态',
                saturated ? (
                    <span style={{ color: '#ff4d4f' }}>已满负荷</span>
                ) : (
                    <span style={{ color: '#52c41a' }}>空闲可用</span>
                ),
            )}
           
            <div
                style={{
                    marginTop: 6,
                    paddingTop: 6,
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                }}
            >
                {confirming ? (
                    <Flex gap={6} align="center" justify="space-between">
                        <span style={{ color: '#ff4d4f' }}>确认清理全部容器？</span>
                        <Flex gap={6}>
                            <Button size="small" danger loading={cleaning} onClick={handleCleanup}>
                                确认
                            </Button>
                            <Button size="small" disabled={cleaning} onClick={() => setConfirming(false)}>
                                取消
                            </Button>
                        </Flex>
                    </Flex>
                ) : (
                    <Button
                        type="text"
                        size="small"
                        danger
                        block
                        icon={<DeleteOutlined />}
                        onClick={() => setConfirming(true)}
                    >
                        清理全部容器
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                // 弹窗关闭时重置二次确认状态（正在清理时保持，避免请求完成前状态错乱）。
                if (!next && !cleaning) {
                    setConfirming(false);
                }
            }}
            trigger="hover"
            placement="bottomRight"
            mouseEnterDelay={0.1}
            content={content}
        >
            <Flex
                gap={4}
                align="center"
                onClick={handleClick}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    padding: '0 6px',
                    borderRadius: 4,
                    background: hovered ? 'rgba(0,0,0,0.06)' : 'transparent',
                    lineHeight: '20px',
                    fontSize: 12,
                    transition: 'background 0.2s',
                }}
            >
                <Typography.Text style={{ color: activeColor, fontWeight: 600 }}>
                    {status.active_count}
                </Typography.Text>
                <span style={{ color: '#bbb' }}>/</span>
                <Typography.Text style={{ color: '#888' }}>
                    {status.max_concurrency}
                </Typography.Text>
                {status.pending_count > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, color: pendingColor }}>
                        <ClockCircleOutlined style={{ fontSize: 11 }} />
                        <span>{status.pending_count}</span>
                    </span>
                )}
            </Flex>
        </Popover>
    );
};

export default ContainerQueueMonitor;
