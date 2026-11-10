import React, { useCallback, useEffect, useState } from 'react';
import { Avatar, Button, Dropdown, Layout, Tag, Tooltip, Typography, message } from 'antd';
import type { MenuProps } from 'antd';
import { SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { useSSE } from '@/context/sse/useSSE';
import { invoke } from '@/core/ui-system/invokeV2';
import { activateProjectApi, type ProjectItem } from '@/api/project';
import { checkContainerRuntimeApi, type ContainerRuntimeHealth } from '@/api/container';
import { clearUserSession, loadActiveProject, loadCurrentUser } from '@/store/userSlice';
import { logoutApi } from '@/api/auth';
import { getPathname } from '@/utils/utils';
import { cancelPendingMenuTabsSave } from '../main-tab-config-save';
import { cancelPendingBottomPanelSave } from '../bottom-panel-store';

type AppHeaderProps = {
    backgroundColor: string;
};

const { Header } = Layout;

const AppHeader: React.FC<AppHeaderProps> = ({ backgroundColor }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const project = useSelector((state: any) => state.user.project);
    const userInfo = useSelector((state: any) => state.user.userInfo);
    const [messageApi, messageContextHolder] = message.useMessage();
    const { status, reconnect } = useSSE();
    // runtimeHealth === null 表示尚未拿到检测结果（首次加载中）；检测失败时 error 非空。
    const [runtimeHealth, setRuntimeHealth] = useState<ContainerRuntimeHealth | null>(null);
    const [runtimeChecking, setRuntimeChecking] = useState(false);

    useEffect(() => {
        dispatch(loadActiveProject() as any);
        dispatch(loadCurrentUser() as any);
    }, [dispatch]);

    // 页面加载时检测默认容器运行时（与容器实际执行同源的解析逻辑），
    // 失败时保留错误信息供 Tooltip 展示，便于用户直接定位 docker / k8s 不可用的原因。
    const checkRuntimeHealth = useCallback(async () => {
        setRuntimeChecking(true);
        try {
            const resp = await checkContainerRuntimeApi();
            // http 未做响应解包：后端直接返回 RuntimeHealth 本体。
            const payload = (resp as any)?.data ?? resp;
            setRuntimeHealth(payload as ContainerRuntimeHealth);
        } catch (error: any) {
            const messageText =
                error?.response?.data?.error?.message || error?.message || 'runtime check failed';
            setRuntimeHealth({
                name: '',
                registered: false,
                healthy: false,
                checkable: false,
                error: messageText,
            });
        } finally {
            setRuntimeChecking(false);
        }
    }, []);

    useEffect(() => {
        void checkRuntimeHealth();
    }, [checkRuntimeHealth]);

    const userDisplayName = userInfo?.username || userInfo?.email || '未登录';
    const userMenuItems: MenuProps['items'] = [
        {
            key: 'user-display',
            label: userDisplayName,
            disabled: true,
        },
        {
            type: 'divider',
        },
        {
            key: 'logout',
            label: '退出登录',
        },
    ];

    const handleUserMenuClick: MenuProps['onClick'] = async ({ key }) => {
        if (key !== 'logout') return;

        try {
            await logoutApi();
        } catch (error) {
            console.warn('logout api failed, fallback to local sign-out', error);
        } finally {
            dispatch(clearUserSession());
            axios.defaults.headers.common.Authorization = '';
            window.location.hash = '/login';
        }
    };

    const handleProjectSwitch = async () => {
        try {
            const value = (await invoke.projectTable.openAsync(undefined, {
                title: 'Switch Project',
                width: 1000,
                footer: null,
            })) as ProjectItem;

            if (!value?.project_id) return;

            // 菜单配置写入的是「服务端当前激活项目」：切换前先丢弃还在防抖中、尚未发出的
            // 旧项目配置，否则它们会在切换完成后到达，被写到新项目上。
            cancelPendingMenuTabsSave();
            cancelPendingBottomPanelSave();

            await activateProjectApi({ project_id: value.project_id });
            // 切换项目后回到首页：当前深链路由属于上一个项目，不应带到新项目里去。
            // 必须在刷新菜单配置前跳转，否则新项目的标签页会先把旧路由补进去并落库。
            navigate('/');
            // 菜单配置（标签页 / 底部面板）按项目落库，切换后先刷新 userInfo
            // （/auth/me 会按新的激活项目返回 menu_config），再刷新项目信息。
            await dispatch(loadCurrentUser() as any);
            await dispatch(loadActiveProject() as any);
            messageApi.success(`Switching Project: ${value.project_name}`);
        } catch (error) {
            // User canceled the switch modal.
        }
    };

    const connectionLabel =
        status === 'open' ? 'connected' : status === 'connecting' ? 'connecting' : 'connection fail';
    const connectionColor =
        status === 'open' ? 'success' : status === 'connecting' ? 'processing' : 'error';

    // 运行时标签：检测中 -> processing；未注册 / 探测失败 -> error；正常 -> success。
    const runtimeHealthy = !!runtimeHealth?.registered && !!runtimeHealth?.healthy && !runtimeHealth?.error;
    const runtimeLabel = runtimeChecking && !runtimeHealth
        ? 'runtime checking'
        : runtimeHealthy
            ? `runtime ${runtimeHealth?.name || ''}`.trim()
            : `runtime ${runtimeHealth?.name || 'unknown'} fail`;
    const runtimeColor = runtimeChecking && !runtimeHealth ? 'processing' : runtimeHealthy ? 'success' : 'error';
    // 鼠标悬浮提示：异常时展示后端原始错误（含 runtime not found / ping docker daemon 等），
    // 正常时展示当前生效的运行时名称。
    const runtimeTip = runtimeHealthy
        ? `Default runtime: ${runtimeHealth?.name || '-'}`
        : (runtimeHealth?.error || (runtimeChecking ? 'Checking container runtime...' : 'Container runtime is not available'));

    const handleOpenSetting = () => {
        invoke.layoutSettingDrawer.drawer({}, {
            title: 'Setting',
            width: 420,
        });
    };

    return (
        <>
            {messageContextHolder}
            <Header className="layout-sharp-header" style={{ background: backgroundColor }}>
                <div className="layout-sharp-header-left">
                    <Typography.Text strong className="layout-sharp-brand-text">BRAVE</Typography.Text>
                </div>
                <div className="layout-sharp-header-right">
                    <Button size="small" onClick={() => {
                        window.open(`${getPathname()}/docs/${project.project_id}/`, "_blank")
                    }}>docs</Button>
                    {project?.project_name ? (
                        <Tag color="blue" className="layout-sharp-clickable" onClick={handleProjectSwitch}>
                            {project.project_name}
                        </Tag>
                    ) : null}
                    <Tag color={connectionColor} className="layout-sharp-clickable" onClick={reconnect}>
                        {connectionLabel}
                    </Tag>
                    {/* 默认容器运行时状态：悬停展示错误信息，点击重新检测。 */}
                    <Tooltip title={runtimeTip}>
                        <Tag
                            color={runtimeColor}
                            className="layout-sharp-clickable"
                            onClick={() => void checkRuntimeHealth()}
                        >
                            {runtimeLabel}
                        </Tag>
                    </Tooltip>
                    <SettingOutlined className="layout-sharp-clickable" onClick={handleOpenSetting} />

                    <Dropdown
                        trigger={['hover']}
                        menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                        placement="bottomRight"
                    >
                        <Avatar size={26} className="layout-sharp-clickable" icon={<UserOutlined />}>
                            {userInfo?.username?.charAt(0).toUpperCase() || userInfo?.email?.charAt(0).toUpperCase()}
                        </Avatar>
                    </Dropdown>
                </div>
            </Header>
        </>
    );
};

export default AppHeader;
