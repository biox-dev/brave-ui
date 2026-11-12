import React, { useCallback, useMemo, useState } from 'react';
import { Button, Descriptions, Flex, Popover, Typography } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import type { ContainerRuntimeHealth } from '@/api/container';
import { loadRuntimeInfo } from '@/store/userSlice';

const { Text } = Typography;

/** 容器运行时安装向导路由（仅在 provision_enabled=true 时展示入口）。 */
const PROVISION_ROUTE = '/container-runtime-provision';

/** bash 工具执行位置的展示文案：host=宿主机，container=容器模板终端。 */
const BASH_MODE_LABEL: Record<string, string> = {
    host: 'Host',
    container: 'Container',
};

/** 空值统一显示为 '-'，避免详情面板出现空白单元格。 */
const orDash = (value?: string | number | null) =>
    value === undefined || value === null || `${value}` === '' ? '-' : `${value}`;

/**
 * 容器运行时状态（底部状态栏）。
 *
 * 数据来源是 redux 里的 `user.runtimeInfo`（页面刷新时由 `loadRuntimeInfo` 拉取一次），
 * 因此可以放在任意位置复用；点击会重新检测并刷新全局状态。
 *
 * 视觉与 ContainerQueueMonitor 保持一致：状态圆点 + 小字号文本 + hover 底色，
 * 不使用 Tag，避免在 28px 高的底栏里显得笨重。
 *
 * hover 弹层展示运行时详情（地址 / 版本 / 宿主 / bash 执行位置 / 运行时预置开关）。
 * 当 `provision_enabled=true` 时额外提供「Container Runtime」安装向导入口按钮；
 * 为 false 时该入口（含设置菜单里的同名菜单项）不展示。
 */
const RuntimeStatus: React.FC = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const runtimeInfo: ContainerRuntimeHealth | null = useSelector((state: any) => state.user.runtimeInfo);
    const runtimeLoading: boolean = useSelector((state: any) => state.user.runtimeLoading);
    const [hovered, setHovered] = useState(false);
    const [open, setOpen] = useState(false);

    const refresh = useCallback(() => {
        void dispatch(loadRuntimeInfo() as any);
    }, [dispatch]);

    const openProvision = useCallback(() => {
        setOpen(false);
        navigate(PROVISION_ROUTE);
    }, [navigate]);

    const healthy = !!runtimeInfo?.registered && !!runtimeInfo?.healthy && !runtimeInfo?.error;
    const checking = runtimeLoading && !runtimeInfo;

    const runtimeName = runtimeInfo?.name || 'unknown';
    const hostOS = runtimeInfo?.host_os || 'unknown';
    const hostArch = runtimeInfo?.host_arch || '';

    const dotColor = checking ? '#1890ff' : healthy ? '#52c41a' : '#ff4d4f';

    const label = checking ? 'checking' : runtimeName;
    const hostLabel = checking ? hostOS : hostArch ? `${hostOS}/${hostArch}` : hostOS;

    // 后端返回的运行时预置开关：只有为 true 才展示安装向导入口。
    const provisionEnabled = runtimeInfo?.provision_enabled === true;
    const bashMode = (runtimeInfo?.bash_execution_mode || '').trim();
    const bashModeLabel = BASH_MODE_LABEL[bashMode] || orDash(bashMode);

    // 详情面板：运行环境 + bash 工具执行位置 + 运行时预置开关。
    const detail = useMemo(() => {
        const items = [
            { key: 'name', label: 'Runtime', children: orDash(runtimeName) },
            {
                key: 'status',
                label: 'Status',
                children: checking ? 'checking' : healthy ? 'healthy' : 'unavailable',
            },
            ...(runtimeInfo?.error
                ? [{ key: 'error', label: 'Error', children: <Text type="danger">{runtimeInfo.error}</Text> }]
                : []),
            { key: 'version', label: 'Version', children: orDash(runtimeInfo?.server_version) },
            { key: 'endpoint', label: 'Endpoint', children: orDash(runtimeInfo?.endpoint) },
            { key: 'source', label: 'Source', children: orDash(runtimeInfo?.endpoint_source) },
            {
                key: 'host',
                label: 'Host',
                children: hostArch ? `${orDash(hostOS)}/${hostArch}` : orDash(hostOS),
            },
            { key: 'bash_mode', label: 'Bash Mode', children: bashModeLabel },
            // 只有 container 模式才需要展示所用的容器模板 ID。
            ...(bashMode === 'container'
                ? [
                    {
                        key: 'bash_template',
                        label: 'Bash Template ID',
                        children: orDash(runtimeInfo?.bash_container_template_id),
                    },
                ]
                : []),
            {
                key: 'provision',
                label: 'Provision',
                children: provisionEnabled ? 'enabled' : 'disabled',
            },
        ];

        return (
            <Flex vertical gap={8} style={{ width: 320 }}>
                <Descriptions size="small" column={1} colon items={items} />
                <Flex gap={8} justify="flex-end">
                    <Button size="small" onClick={refresh} loading={runtimeLoading}>
                        Recheck
                    </Button>
                    {provisionEnabled && (
                        <Button size="small" type="primary" onClick={openProvision}>
                            Container Runtime
                        </Button>
                    )}
                </Flex>
            </Flex>
        );
    }, [
        bashMode,
        bashModeLabel,
        checking,
        healthy,
        hostArch,
        hostOS,
        openProvision,
        provisionEnabled,
        refresh,
        runtimeInfo,
        runtimeLoading,
        runtimeName,
    ]);

    return (
        <Popover
            trigger="hover"
            open={open}
            onOpenChange={setOpen}
            placement="top"
            content={detail}
        >
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
        </Popover>
    );
};

export default RuntimeStatus;
