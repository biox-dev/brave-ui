import React, { useEffect } from 'react';
import { Avatar, Dropdown, Layout, Tag, Typography, message } from 'antd';
import type { MenuProps } from 'antd';
import { SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { useSSE } from '@/context/sse/useSSE';
import { invoke } from '@/core/ui-system/invokeV2';
import { activateProjectApi, type ProjectItem } from '@/api/project';
import { clearUserSession, loadActiveProject } from '@/store/userSlice';
import { logoutApi } from '@/api/auth';
import ContainerQueueMonitor from '@/components/container-manager/container-monitor';

type AppHeaderProps = {
    backgroundColor: string;
};

const { Header } = Layout;

const AppHeader: React.FC<AppHeaderProps> = ({ backgroundColor }) => {
    const dispatch = useDispatch();
    const projectObj = useSelector((state: any) => state.user.projectObj);
    const userInfo = useSelector((state: any) => state.user.userInfo);
    const [messageApi, messageContextHolder] = message.useMessage();
    const { status, reconnect } = useSSE();

    useEffect(() => {
        dispatch(loadActiveProject() as any);
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
                width: 900,
                footer: null,
            })) as ProjectItem;

            if (!value?.project_id) return;

            await activateProjectApi({ project_id: value.project_id });
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
                    {/* <Typography.Text strong>BRAVE</Typography.Text> */}
                </div>
                <div className="layout-sharp-header-right">
                    <ContainerQueueMonitor />
                    {projectObj?.project_name ? (
                        <Tag color="blue" className="layout-sharp-clickable" onClick={handleProjectSwitch}>
                            {projectObj.project_name}
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
