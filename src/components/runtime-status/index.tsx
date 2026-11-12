import React, { useCallback, useMemo, useState } from 'react';
import { Flex, Tooltip } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import type { ContainerRuntimeHealth } from '@/api/container';
import { loadRuntimeInfo } from '@/store/userSlice';

/**
 * 容器运行时状态（底部状态栏）。
 *
 * 数据来源是 redux 里的 `user.runtimeInfo`（页面刷新时由 `loadRuntimeInfo` 拉取一次），
 * 因此可以放在任意位置复用；点击会重新检测并刷新全局状态。
 *
 * 视觉与 ContainerQueueMonitor 保持一致：状态圆点 + 小字号文本 + hover 底色，
 * 不使用 Tag，避免在 28px 高的底栏里显得笨重。
 */
const RuntimeStatus: React.FC = () => {
    const dispatch = useDispatch();
    const runtimeInfo: ContainerRuntimeHealth | null = useSelector((state: any) => state.user.runtimeInfo);
    const runtimeLoading: boolean = useSelector((state: any) => state.user.runtimeLoading);
    const [hovered, setHovered] = useState(false);

    const refresh = useCallback(() => {
        void dispatch(loadRuntimeInfo() as any);
    }, [dispatch]);

    const healthy = !!runtimeInfo?.registered && !!runtimeInfo?.healthy && !runtimeInfo?.error;
    const checking = runtimeLoading && !runtimeInfo;

    const runtimeName = runtimeInfo?.name || 'unknown';
    const hostOS = runtimeInfo?.host_os || 'unknown';
    const hostArch = runtimeInfo?.host_arch || '';

    const dotColor = checking ? '#1890ff' : healthy ? '#52c41a' : '#ff4d4f';

    const label = checking ? 'checking' : runtimeName;
    const hostLabel = checking ? hostOS : hostArch ? `${hostOS}/${hostArch}` : hostOS;

    // 异常时展示后端原始错误（如 ping docker daemon 失败），正常时展示连接地址与版本。
    const tip = useMemo(() => {
        if (!healthy) {
            return runtimeInfo?.error || (runtimeLoading ? 'Checking container runtime...' : 'Container runtime is not available');
        }
        return [
            `Runtime: ${runtimeName}`,
            runtimeInfo?.server_version ? `Version: ${runtimeInfo.server_version}` : '',
            runtimeInfo?.endpoint ? `Endpoint: ${runtimeInfo.endpoint}` : '',
            runtimeInfo?.endpoint_source ? `Source: ${runtimeInfo.endpoint_source}` : '',
            `Host: ${hostOS}${hostArch ? `/${hostArch}` : ''}`,
        ]
            .filter(Boolean)
            .join('\n');
    }, [healthy, runtimeInfo, runtimeLoading, runtimeName, hostOS, hostArch]);

    return (
        <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{tip}</span>}>
            <Flex
                gap={4}
                align="center"
                onClick={refresh}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    cursor: 'pointer',
                    padding: '0 6px',
                    borderRadius: 4,
                    background: hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
                    lineHeight: '20px',
                    fontSize: 12,
                    userSelect: 'none',
                    transition: 'background 0.15s',
                }}
            >
                <span
                    style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: dotColor,
                        flex: '0 0 auto',
                        boxShadow: `0 0 0 2px ${dotColor}22`,
                    }}
                />
                <span style={{ color: 'var(--sharp-text-soft)' }}>{label}</span>
                <span style={{ color: 'var(--sharp-divider-strong)' }}>·</span>
                <span style={{ color: 'var(--sharp-text-soft)', opacity: 0.85 }}>{hostLabel}</span>
            </Flex>
        </Tooltip>
    );
};

export default RuntimeStatus;
