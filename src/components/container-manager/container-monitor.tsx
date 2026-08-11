import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Switch, Tooltip, Flex, Typography, Button } from 'antd';
import { ReloadOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { http } from '@/api/client/http';

interface QueueStatus {
    active_count: number;
    pending_count: number;
    max_concurrency: number;
    max_pending: number;
    queue_enabled: boolean;
}

const POLL_INTERVAL = 5000;

const ContainerQueueMonitor: React.FC = () => {
    const [status, setStatus] = useState<QueueStatus | null>(null);
    const [error, setError] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // Fetch once on mount.
    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    // Toggle auto-refresh interval.
    useEffect(() => {
        if (autoRefresh) {
            timerRef.current = setInterval(fetchStatus, POLL_INTERVAL);
        }
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [autoRefresh, fetchStatus]);

    if (error && !status) {
        return null;
    }

    if (!status || !status.queue_enabled) {
        return null;
    }

    const activeColor = status.active_count >= status.max_concurrency ? '#ff4d4f' : '#52c41a';

    return (
        <Flex gap={6} align="center" style={{ fontSize: 12 }}>
            <Tooltip
                title={
                    <div style={{ fontSize: 12 }}>
                        <div>运行中: {status.active_count} / {status.max_concurrency}</div>
                        <div>等待中: {status.pending_count} / {status.max_pending}</div>
                    </div>
                }
            >
                <Flex
                    gap={4}
                    align="center"
                    style={{
                        cursor: 'default',
                        padding: '0 4px',
                        borderRadius: 4,
                        background: 'rgba(0,0,0,0.04)',
                        lineHeight: '20px',
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
                        <ClockCircleOutlined style={{ color: '#faad14', fontSize: 11 }} />
                    )}
                </Flex>
            </Tooltip>

            <Tooltip title="刷新">
                <Button
                    type="text"
                    size="small"
                    icon={<ReloadOutlined spin={loading} style={{ fontSize: 12 }} />}
                    onClick={fetchStatus}
                    style={{ padding: 0, minWidth: 20, height: 20 }}
                />
            </Tooltip>

            <Tooltip title={autoRefresh ? '关闭自动刷新' : '开启自动刷新 (5s)'}>
                <Switch
                    size="small"
                    checked={autoRefresh}
                    onChange={setAutoRefresh}
                />
            </Tooltip>
        </Flex>
    );
};

export default ContainerQueueMonitor;
