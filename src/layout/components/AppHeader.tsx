import React, { useEffect } from 'react';
import { Avatar, Button, Dropdown, Layout, Tag, Typography, message } from 'antd';
import type { MenuProps } from 'antd';
import { SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import axios from 'axios';
import { useSSE } from '@/context/sse/useSSE';
import { invoke } from '@/core/ui-system/invokeV2';
import { activateProjectApi, type ProjectItem } from '@/api/project';
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

    useEffect(() => {
        dispatch(loadActiveProject() as any);
        dispatch(loadCurrentUser() as any);
    }, [dispatch]);

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
