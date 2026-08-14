import React, { FC, Suspense, useEffect, useState, lazy } from 'react';
import { ApiOutlined, AppstoreOutlined, BookOutlined, CodeOutlined, CompassOutlined, ContainerOutlined, DashboardOutlined, FileTextOutlined, FolderOpenOutlined, LaptopOutlined, MenuOutlined, NotificationOutlined, PlusOutlined, ReadOutlined, SettingOutlined, ToolOutlined, UserOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { Breadcrumb, Button, Card, Col, Divider, Drawer, Dropdown, Empty, Flex, Form, Grid, Input, Layout, Menu, message, Modal, notification, Popconfirm, Row, Segmented, Select, Skeleton, Space, Tag, theme, Tooltip, Typography } from 'antd';
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { Header } from 'antd/es/layout/layout';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { clearUserSession, loadActiveProject, setUserItem } from '@/store/userSlice'
import { setSetting, setSseData } from '@/store/globalSlice'
import { invoke } from "@/core/ui-system/invokeV2";

import useMessage from 'antd/es/message/useMessage';
import { useModal, useModals } from '@/hooks/useModal';
import ContextModal from '@/components/context';
import FormProject from '@/components/form-project';
import { activateProjectApi, deleteProjectApi, type ProjectItem } from '@/api/project';
import { Project } from '@/type/project';
import { useI18n } from '@/hooks/useI18n';
import LanguageSelector from '@/components/setting-switcher/language';
import ThemeSelector from '@/components/setting-switcher/theme';
import { CreateOrUpdateNamespace, InstallNamespace } from '@/components/namespace-operature';
import { useGlobalMessage } from '@/hooks/useGlobalMessage';
import TextArea from 'antd/es/input/TextArea';
import { keyEqualTo } from '@antv/s2/esm/utils/export/method.js';
import { useStickyTop } from '@/hooks/useStickyTop';
import ComponentRender from './component-render';
import { SideViewProvider, useSideViewContext } from '@/context/side/SideViewContext';
import { useSSE } from '@/context/sse/useSSE';
import { ActionDispatcher } from '@/llmv2/dispatcher';
import ViewResolver from '@/core/ui-renderer/ViewResolver';
import { useComponentStore } from '@/store-zustand/components';
import { useUI } from '@/core/ui-system/useUI';
import { logoutApi } from '@/api/auth';
import { getSettingApi } from '@/api/setting';
import { getPathname } from '@/utils/utils';
import ContainerQueueMonitor from '@/components/container-manager/container-monitor';

const { Content, Sider } = Layout;

type NotificationType = 'success' | 'info' | 'warning' | 'error';


const items2: MenuProps['items'] = [UserOutlined, LaptopOutlined, NotificationOutlined].map(
    (icon, index) => {
        const key = String(index + 1);

        return {
            key: `sub${key}`,
            icon: React.createElement(icon),
            label: `subnav ${key}`,
            children: Array.from({ length: 4 }).map((_, j) => {
                const subKey = index * 4 + j + 1;
                return {
                    key: subKey,
                    label: `option${subKey}`,
                };
            }),
        };
    },
);


const Test = () => {
    // useEffect(() => {
    //     console.log("wssssssssssssssssssss")
    // }, [])
    return <Skeleton active></Skeleton>
}
const App: React.FC = () => {
    const { theme, baseURL, projectObj, project: project_id, network, userInfo } = useSelector((state: any) => state.user); // 'light' | 'dark'
    const navigate = useNavigate();
    const location = useLocation();
    const [leftMenus, setLeftMenus] = useState<any>([])
    const dispatch = useDispatch()
    const [notificationApi, notificationContextHolder] = notification.useNotification();
    const [messageApi, messageContextHolder] = message.useMessage();
    const { modals, openModals, closeModals } = useModals(["setting", "project"]);
    // const [projectObj, setProjectObj] = useState<any>({})
    const [current, setCurrent] = useState('/');
    const [menus, setMenus] = useState<any>([])
    const [selectedKeyMap, setSelectedKeyMap] = useState<any>()
    const [siderCollapsed, setSiderCollapsed] = useState(false)
    const { t, locale } = useI18n();
    const screens = Grid.useBreakpoint();
    const isMobileLayout = !screens.md;
    const appHeaderHeight = 64 + 16;
    const sidePanelHeight = `calc(100dvh - ${appHeaderHeight}px)`;

    const isDark = theme === 'dark';
    const bgColor = isDark ? 'linear-gradient(180deg, #1c1c1c 0%, #141414 100%)' : '#fff';
    const textColor = isDark ? '#f5f5f5' : '#000';
    const headerBorderColor = isDark ? 'rgba(255,255,255,0.14)' : '#f0f0f0';
    const headerShadow = isDark ? '0 2px 12px rgba(0,0,0,0.32)' : '0 1px 6px rgba(15,23,42,0.08)';
    const siderBgColor = isDark ? '#101010' : '#fff';
    const { sideView, setSideView, sideOptions, setSideOptions } = useSideViewContext();


    const { ref: containerRef, top, isSticky } = useStickyTop(576);
    // const [sideView, setSideView] = useState<string>("llm-card")
    // const [isConnect, setIsConnect] = useState<"UNKNOW" | "CONNECT" | "NOT_CONNECT">("UNKNOW")

    // const ping = async () => {
    //     try {
    //         await axios.get(`${baseURL}/brave-api/ping`)
    //         // setIsConnect("CONNECT")
    //         dispatch(setUserItem({ network: "CONNECT" }))

    //     } catch (error) {
    //         // setIsConnect("NOT_CONNECT")
    //         dispatch(setUserItem({ network: "NOT_CONNECT" }))

    //     }
    // }
    // useEffect(() => {
    //     ping()
    // }, [baseURL])

    useEffect(() => {
        setSiderCollapsed(isMobileLayout)
    }, [isMobileLayout])

    const openNotification = ({ type, message = "", description = "" }: { type: NotificationType, message: string, description?: string }) => {
        notificationApi[type]({
            message: message,
            description: description,
            placement: "bottomRight"
        });
    };
    const userDisplayName = userInfo?.username || userInfo?.email || '未登录';
    const userMenuItems: MenuProps['items'] = [
        {
            key: 'user-display',
            label: (
                <div style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {userDisplayName}
                </div>
            ),
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
            axios.defaults.headers.common['Authorization'] = '';
            window.location.hash = '/login';
        }
    };
    console.log(project_id)
    const onMenuClick = (key: string) => {
        console.log(key)
        navigate(key);
        setCurrent(key)
    }

    const handleMainMenuSelect: MenuProps['onSelect'] = (k) => {
        if (k.key == "/psycmicrograph") {
            window.open(`${window.location.origin}${window.location.pathname}psycmicrograph.html`, "_blank")
            return
        }
        if (k.key == "/literature-intelligence") {
            window.open(`https://www.mbiolance.com/c/news/`, "_blank")
            return
        }
        onMenuClick(k.key)
        if (isMobileLayout) {
            setSiderCollapsed(true)
        }
        console.log(k)
    }

    const getSetting = async () => {
        const resp = await getSettingApi()
        console.log(resp.data)
        dispatch(setSetting(resp.data))
    }
    const { status, reconnect } = useSSE((data: any) => {
        console.log("收到消息 =>", data);
        if (data.msgType === "process_end") {
            const analysis: any = data.analysis
            const msg = `${analysis.analysis_name}(${analysis.analysis_id}) 分析完成`
            openNotification({ type: "info", message: msg })
        }
        if (data.msgType === "analysis_result") {

            openNotification({ type: "info", message: `${data?.analysis_name}: Add Analsyis: ${data?.add_num}; Update Analysis: ${data?.update_num}; Complete Analysis: ${data?.complete_num}` })
        }

        if (data.msgType === "test") {
            openNotification({ type: "info", message: data.msg })
        }
        if (data?.type != "ping") {
            // console.log("layout SSE message:", event.data);
            dispatch(setSseData(data))

        }
    });

    // const { eventSourceRef, status, reconnect } = useSSEContext();
    // useEffect(() => {
    //     console.log("layout eventSourceRef", eventSourceRef)
    //     if (!eventSourceRef) return;

    //     const handler = (event: MessageEvent) => {

    //         const data = JSON.parse(event.data)
    //         // console.log("1111111111111111",data )
    //         // console.log(data)
    //         if (data.msgType === "process_end") {
    //             const analysis: any = data.analysis
    //             const msg = `${analysis.analysis_name}(${analysis.analysis_id}) 分析完成`
    //             openNotification({ type: "info", message: msg })
    //         }
    //         if (data.msgType === "analysis_result") {

    //             openNotification({ type: "info", message: `${data?.analysis_name}: Add Analsyis: ${data?.add_num}; Update Analysis: ${data?.update_num}; Complete Analysis: ${data?.complete_num}` })
    //         }

    //         if (data.msgType === "test") {
    //             openNotification({ type: "info", message: data.msg })
    //         }
    //         if (data?.type != "ping") {
    //             console.log("layout SSE message:", event.data);
    //             dispatch(setSseData(data))

    //         }
    //     };

    //     eventSourceRef.current?.addEventListener('message', handler);

    //     return () => {
    //         console.log("removeEventListener")
    //         eventSourceRef.current?.removeEventListener('message', handler);
    //     };
    // }, [eventSourceRef.current]);

    // const [eventSource, setEventSource] = useState<EventSource | null>(null);

    // useEffect(() => {
    //     const eventSource = new EventSource('/brave-api/sse-group');
    //     setEventSource(eventSource);
    //     eventSource.addEventListener('message', (event) => {

    // const data = JSON.parse(event.data)
    // // console.log(data )

    // if(data.msgType === "process_end"){
    //     const analysis:any = data.analysis
    //     const msg = `${analysis.analysis_name}(${analysis.analysis_id}) 分析完成`
    //     openNotification({ type: "info", message: msg })
    // }
    // if (data.msgType === "analysis_result"){

    //     openNotification({ type: "info", message: data.msg })
    // }
    // dispatch(setSseData(event.data))
    //     });

    //     // eventSource.onmessage = (event) => {
    //     //     //   setMessages(prev => [...prev, event.data]);

    //     // };

    //     eventSource.onerror = (err) => {
    //         console.error('SSE connection error:', err);
    //         eventSource.close(); // 可选：关闭连接
    //     };

    //     return () => {
    //         eventSource.close(); // 组件卸载时关闭连接
    //     };
    // }, [])

    // const eventSourceRef :React.RefObject < EventSource | null> = useSSE(openNotification)
    useEffect(() => {
        dispatch(loadActiveProject() as any)
        getSetting()
    }, [])
    // const {
    //     token: { colorBgContainer, borderRadiusLG },
    // } = theme.useToken();

    const menu0: any = [
        {
            key: "/",
            icon: "dashboard",
            label: {
                zh_CN: "仪表盘",
                en_US: "Dashboard"
            }

        },
        // {
        //     key: "/doc",
        //     label: {
        //         zh_CN: "文档",
        //         en_US: "Doc"
        //     }

        // },
        // {
        //     key: `/sample`,
        //     label: "检测样本"
        // }, 
        {
            key: "/c/scripts",
            icon: "code",
            label: {
                zh_CN: "脚本",
                en_US: "Scripts"
            }
        },
        {
            key: "/c/tools",
            icon: "tools",
            label: {
                zh_CN: "工具",
                en_US: "Tools"
            }
        },


        // {
        //     key: `/apps`,
        //     label: {
        //         zh_CN: "应用",
        //         en_US: "Apps"
        //     },
        //     children: [
        //     ]
        // },
        {
            key: `/files`,
            icon: "files",
            label: {
                zh_CN: "文件",
                en_US: "Files"
            }
        }, {
            key: `/app-session`,
            icon: "container",
            label: {
                zh_CN: "应用会话",
                en_US: "App Session"
            },
        },
        {
            key: `/analysis-report`,
            icon: "report",
            label: {
                zh_CN: "分析报告",
                en_US: "Report"
            }

        }, {
            key: `/container`,
            icon: "container",
            label: {
                zh_CN: "容器管理",
                en_US: "Container"
            },
            children: [


                {
                    key: `/container-instance`,
                    icon: "container",
                    label: {
                        zh_CN: "容器实例",
                        en_US: "Container Instance"
                    },
                },
                // {
                //     key: `/container-event`,
                //     icon: "container",
                //     label: {
                //         zh_CN: "容器事件",
                //         en_US: "Container Event"
                //     },
                // },
                {
                    key: `/outbox-event`,
                    icon: "container",
                    label: {
                        zh_CN: "出箱事件",
                        en_US: "Outbox Event"
                    },
                },
                {
                    key: `/container-image`,
                    icon: "container",
                    label: {
                        zh_CN: "容器镜像",
                        en_US: "Container Image"
                    },
                },
                {
                    key: `/container-template`,
                    icon: "container",
                    label: {
                        zh_CN: "容器模板",
                        en_US: "Container Template"
                    },
                },
            ]
        },
        // {
        //     key: `/entity-page`,
        //     label: "研究实体"

        // }, {
        //     key: `/entity-relation`,
        //     label: "实体关系"

        // },
        {
            key: `/more`,
            icon: "apps",
            label: {
                zh_CN: "更多",
                en_US: "More"
            },
            children: [
                // {

                //     key: `/workflow-card`,
                //     label: {
                //         zh_CN: "工作流",
                //         en_US: "Workflows"
                //     },
                //     children: [
                //         {
                //             key: `/relation/workflow`,
                //             hidden: true
                //         }
                //     ]
                // }, 
                {
                    key: "/explore",
                    icon: "explore",
                    label: {
                        zh_CN: "探索",
                        en_US: "Explore"
                    }

                }, {
                    key: `/tasks`,
                    icon: "apps",
                    label: {
                        zh_CN: "任务",
                        en_US: "Tasks"
                    },
                }, {
                    key: "/c/file",
                    icon: "files",
                    label: {
                        zh_CN: "文件",
                        en_US: "Files"
                    }
                }, {

                    key: `/componentsV2/file`,
                    icon: "files",
                    label: {
                        zh_CN: "文件",
                        en_US: "Files"
                    }

                }, {
                    key: `/container-page`,
                    icon: "container",
                    label: {
                        zh_CN: "容器管理(deprecated)",
                        en_US: "Container(deprecated)"
                    },
                }, {
                    key: `/interactive-tools`,
                    icon: "tools",
                    label: {
                        zh_CN: "交互工具",
                        en_US: "Interactive Tools"
                    }
                }, {
                    key: `/tool-kit`,
                    icon: "tools",
                    label: {
                        zh_CN: "工具集",
                        en_US: "TookKit"
                    }
                },
                //  {
                //     key: `/psycmicrograph`,
                //     label: {
                //         zh_CN: "菌群知识库",
                //         en_US: "PsycMicroGraph"
                //     }
                // },
                // {
                //     key: `/analysis-result`,
                //     label: {
                //         zh_CN: "分析结果",
                //         en_US: "Analysis Result"
                //     },
                // },
                {
                    key: `/literature`,
                    icon: "literature",
                    label: {
                        zh_CN: "文献资料",
                        en_US: "Literature"
                    }
                }, {

                    key: `/componentsV2/script`,
                    icon: "code",
                    label: {
                        zh_CN: "脚本",
                        en_US: "Scripts"
                    }
                }, {

                    key: `/tools-card`,
                    label: {
                        zh_CN: "工具-old",
                        en_US: "Tools-old"
                    },
                    children: [
                        {
                            key: `/relation/tools`,
                            hidden: true
                        }
                    ]
                }, {
                    key: "/analysis-report-old",
                    label: {
                        zh_CN: "分析报告(old)",
                        en_US: "Report(old)"
                    }
                }, {
                    key: `/file-card`,
                    label: {
                        zh_CN: "文件(deprecated)",
                        en_US: "File(deprecated)"
                    },
                    children: [
                        {
                            key: `/component/file`,
                            // label: "分析报告",
                            hidden: true
                        }
                    ]
                }, {
                    key: `/pipeline-card`,
                    label: {
                        zh_CN: "分析流程(deprecated)",
                        en_US: "Workflows(deprecated)"
                    },
                    children: [
                        {
                            key: `/component/pipeline`,
                            // label: {
                            //     zh_CN: "",
                            //     en_US: "report"
                            // },
                            hidden: true
                        }
                    ]
                },
                {
                    key: `/software-card`,
                    label: {
                        zh_CN: "工具(deprecated)",
                        en_US: "Tools(deprecated)"
                    },
                    children: [
                        {
                            key: `/component/software`,
                            // label: "分析报告",
                            hidden: true
                        }
                    ]
                },

                {
                    key: `/script-card`,
                    label: {
                        zh_CN: "可视化(deprecated)",
                        en_US: "Visualization(deprecated)"
                    },
                    children: [
                        {
                            key: `/component/script`,
                            // label: "分析报告",
                            hidden: true
                        }
                    ]
                },
            ]
        }, {
            key: `/literature-intelligence`,
            icon: "literature",
            label: {
                zh_CN: "文献情报",
                en_US: "Literature Intelligence"
            }

        }


    ]
    type MenuItem = {
        key: string;
        icon?: string;
        label: string;
        children?: MenuItem[];
        hidden?: boolean; // 新增字段
    };
    type MenuItem0 = {
        key: string;
        icon?: string;
        label?: {
            zh_CN: string;
            en_US: string;
        };
        children?: MenuItem0[];
        hidden?: boolean; // 新增字段
    };
    const iconRegistry: Record<string, React.ReactNode> = {
        dashboard: <DashboardOutlined />,
        explore: <CompassOutlined />,
        tools: <ToolOutlined />,
        files: <FolderOpenOutlined />,
        report: <FileTextOutlined />,
        apps: <AppstoreOutlined />,
        literature: <ReadOutlined />,
        container: <ContainerOutlined />,
        code: <CodeOutlined />,
    };

    const resolveMenuIcon = (iconName?: string) => {
        if (!iconName) return undefined;
        return iconRegistry[iconName] ?? <AppstoreOutlined />;
    };

    const filterMenu = (menus: MenuItem[]): MenuProps['items'] => {
        return menus
            .filter(item => !item.hidden)
            .map(item => {
                const newItem: any = { ...item };
                const labelText = item.label[locale];
                newItem.label = (
                    <span
                        style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '100%'
                        }}
                        title={labelText}
                    >
                        {labelText}
                    </span>
                ) as any; // 选择当前语言并处理超长省略
                newItem.icon = resolveMenuIcon(item.icon);
                if (item.children) {
                    newItem.children = filterMenu(item.children) as any[];
                    if (newItem.children.length === 0) delete newItem.children;
                }
                return newItem;
            });
    };
    // const filterMenu = (menus: MenuItem[]): MenuItem[] => {
    //     return menus
    //         .filter(item => !item.hidden)
    //         .map(item => {
    //             const newItem: MenuItem = { ...item };
    //             if (newItem.children) {
    //                 newItem.children = filterMenu(newItem.children);
    //                 if (newItem.children.length === 0) delete newItem.children;
    //             }
    //             return newItem;
    //         });
    // };
    // 生成 path -> selectedKey 映射表，同时按 key 长度降序排序
    const generateSelectedKeyMap = (menus: MenuItem[]) => {
        const map: { key: string; selectedKey: string }[] = [];

        const traverse = (items: MenuItem[], parentKey?: string) => {
            for (const item of items) {
                const mappedKey = item.hidden && parentKey ? parentKey : item.key;
                map.push({ key: item.key, selectedKey: mappedKey });

                if (item.children) {
                    traverse(item.children, mappedKey);
                }
            }
        };

        traverse(menus);

        // 按 key 长度降序排序，保证最长前缀匹配优先
        map.sort((a, b) => b.key.length - a.key.length);
        return map;
    };

    // 根据路径快速查找 selectedKey
    const getSelectedKey = (path: string, selectedKeyMap: { key: string; selectedKey: string }[]) => {
        for (const item of selectedKeyMap) {
            if (path.startsWith(item.key)) {
                return item.selectedKey;
            }
        }
        return "/"; // 默认回退首页
    };
    useEffect(() => {
        // const selectedKeyMap = generateSelectedKeyMap(menu0);
        // setSelectedKeyMap(selectedKeyMap)
        const finalMenu = filterMenu(menu0);
        setMenus(finalMenu)
    }, [locale])
    // 使用示例
    useEffect(() => {
        // const pathname = findSelectedKey(menu0, location.pathname)

        if (!selectedKeyMap) {
            const selectedKeyMap = generateSelectedKeyMap(menu0);
            setSelectedKeyMap(selectedKeyMap)
            const pathname = getSelectedKey(location.pathname, selectedKeyMap)
            console.log("not exist selectedKeyMap", pathname)
            setCurrent(pathname)
        } else {
            // console.log("exist selectedKeyMap",selectedKeyMap)
            const pathname = getSelectedKey(location.pathname, selectedKeyMap)
            setCurrent(pathname)

        }
    }, [location.pathname])
    const menu1: MenuProps['items'] = [
        {
            key: `${project_id}/sample-qc`,
            label: "样本质控"
        }, {
            key: `${project_id}/meta_genome/remove-host`,
            label: "去宿主"
        }, {
            key: `${project_id}/meta_genome/reads-based-abundance-analysis`,
            label: "基于Reads的丰度分析"
        }, {
            key: `${project_id}/meta_genome/recovering-mag`,
            label: "重构MAG"
        }, {
            key: `${project_id}/meta_genome/abundance-meta`,
            label: "丰度分析"
        }, {
            key: `${project_id}/meta_genome/function-analysis`,
            label: "功能分析"
        }, {
            key: `${project_id}/meta_genome/abundance`,
            label: "old丰度分析"
        }
    ]
    // individual meta
    const menu2: any = [
        // {
        //     key: `${project}/single_genome`,
        //     label: "项目介绍"
        // }, {
        //     key: `${project}/single_genome/sample`,
        //     label: "检测样本"
        // }, 
        {
            key: `${project_id}/single_genome/assembly`,
            label: "单菌组装"
        }, {
            key: `${project_id}/single_genome/gene-prediction`,
            label: "基因预测"
        }, {
            key: `${project_id}/single_genome/gene-annotation`,
            label: "基因注释"
        }, , {
            key: `${project_id}/single_genome/gene-expression`,
            label: "基因表达"
        },
        {
            key: `${project_id}/single_genome/mutation`,
            label: "突变检测"
        }, {
            key: `${project_id}/single_genome/mutation-compare`,
            label: "突变比较"
        }
    ]
    const checkProject = () => {
        if (!project_id) {
            // console.log("checkProject",location.pathname)
            if (location.pathname.startsWith("/component") || location.pathname.startsWith("/analysis-report")) {
                return false
            }

            return true
        }
        return true
    }

    const items = [
        {
            key: "menu0",
            label: "实验设计"
        }, {
            key: "menu1",
            label: "宏基因组"
        }, {
            key: "menu2",
            label: "单菌基因组"
        },
    ]


    // const loadProject = async () => {
    //     if (!project_id) return;
    //     const resp = await axios.get(`/project/find-by-project-id/${project_id}`)
    //     // setProjectObj(resp.data)
    //     dispatch(setUserItem({ projectObj: resp.data }))
    // }


    // useEffect(() => {

    //     loadProject()
    // }, [baseURL, project_id])


    return (

        <Layout style={{ minHeight: '100vh' }}>
            {/* {location.key} */}
            {notificationContextHolder}
            {messageContextHolder}
            {/* <Header style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ color: "#fff",marginRight:"1rem" }} >BRAVE</div>
                <Menu
                
                    theme="dark"
                    mode="horizontal"
                    defaultSelectedKeys={['1']}
                    items={menu0}
                    onSelect={k => onMenuClick(k.key)}
                    style={{ flex: 1, minWidth: 0 }}
                />
            </Header> */}
            <Header style={{

                position: 'sticky',
                top: 0,
                zIndex: 10,
                overflow: 'hidden',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                background: bgColor,
                color: textColor,
                borderBottom: `1px solid ${headerBorderColor}`,
                boxShadow: headerShadow,
                backdropFilter: 'saturate(120%) blur(4px)',


            }}>
                <div style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 1,
                    background: isDark
                        ? 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.30), rgba(255,255,255,0))'
                        : 'linear-gradient(90deg, rgba(15,23,42,0), rgba(15,23,42,0.18), rgba(15,23,42,0))'
                }} />
                <Button
                    type='text'
                    icon={<MenuOutlined style={{ color: textColor, fontSize: 16 }} />}
                    onClick={() => setSiderCollapsed(!siderCollapsed)}
                    style={{
                        position: 'absolute',
                        left: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: isMobileLayout ? 'inline-flex' : 'none',
                        zIndex: 12
                    }}
                />
                {/* 左侧：LOGO + 菜单 */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    flex: isMobileLayout ? '0 0 auto' : 1,
                    minWidth: isMobileLayout ? 96 : 0,
                    paddingLeft: isMobileLayout ? 40 : 0,
                    marginRight: 8
                }}>
                    <div style={{
                        color: textColor,
                        marginRight: '1rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        fontWeight: 600
                    }} onClick={async () => {
                        await axios.get("/send-test")
                    }}>BRAVE</div>
                </div>

                {/* 右侧：项目选择 */}
                <Flex align="center" gap={"small"} wrap={false} className='app-header-actions' style={{
                    padding: '4px 8px',
                    borderRadius: 10,
                    background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e5e7eb',
                    maxWidth: isMobileLayout ? '68vw' : 'none',
                    overflowX: isMobileLayout ? 'auto' : 'visible',
                    overflowY: 'hidden',
                    whiteSpace: 'nowrap',
                    scrollbarWidth: 'none',
                    marginLeft: 'auto',
                    width: isMobileLayout ? 'calc(100vw - 156px)' : 'auto'
                }}>
                    <Button size="small" onClick={() => {
                        window.open(`${getPathname()}/docs/${project_id}/`, "_blank")
                    }}>docs</Button>
                    {projectObj?.project_name && <Tooltip title={`Current Project: ${projectObj.project_id}`} placement="bottom">
                        <Tag onClick={async () => {
                            try {
                                const value = await invoke.projectTable.openAsync(undefined, {
                                    title: "Switch Project",
                                    width: 900,
                                    footer: null,
                                }) as ProjectItem
                                if (!value?.project_id) {
                                    return
                                }

                                await activateProjectApi({ project_id: value.project_id })
                                await dispatch(loadActiveProject() as any)
                                messageApi.success(`Switching Project: ${value.project_name}`)
                            } catch (error) {
                                // User canceled project switch modal.
                            }

                        }} color={"blue"} style={{ marginRight: "0.5rem", cursor: "pointer" }}>
                            {projectObj?.project_name}
                        </Tag>
                    </Tooltip>}

                    {/* {isConnect=="NOT_CONNECT" && <>aaaaaaaaaaaa</>} */}
                    <Button size="small"
                        color={status === "open" ? "green" : status === "connecting" ? "blue" : "red"}
                        variant="solid"
                        onClick={reconnect} >
                        {status === "open" ? "connected" : status === "connecting" ? "connecting" : "connection fail"}
                    </Button>
                    <ContainerQueueMonitor />
                    <BookOutlined style={{ cursor: "pointer" }} onClick={() => {
                        window.open(`https://pybrave.github.io/brave-doc`, "_blank")
                    }} />
                    <ApiComp open={network == "NOT_CONNECT"}></ApiComp>

                    <SettingOutlined style={{ cursor: "pointer" }} onClick={() => {
                        openModals("setting")
                    }} />

                    {/* <Button size="small" onClick={async () => {
                        await axios.get("/send-test")
                    }}>
                        sse
                    </Button> */}

                    {/* {checkProject() && <>
                        <ProjectComp onProjectLoad={setProjectList} project_id={project_id} openModal={openModal} setProjectObj={setProjectObj}></ProjectComp>

                    </>} */}

                    {/* <Button color="primary"   onClick={() => {
                      openModal("context")
                    }}>
                        {project}/{namespace}
                    </Button> */}
                    {/* <Button>   {project}</Button> */}
                </Flex>

                {/* 用户头像 */}
                <Dropdown
                    trigger={['hover']}
                    menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                    placement="bottomRight"
                >
                    <div style={{
                        flexShrink: 0,
                        marginLeft: 8,
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: userInfo?.username || userInfo?.email
                            ? (isDark ? 'linear-gradient(135deg,#4096ff,#1677ff)' : 'linear-gradient(135deg,#1677ff,#4096ff)')
                            : (isDark ? '#333' : '#e0e0e0'),
                        border: isDark ? '2px solid rgba(255,255,255,0.18)' : '2px solid #d0d7de',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 700,
                        color: userInfo?.username || userInfo?.email ? '#fff' : (isDark ? '#888' : '#aaa'),
                        letterSpacing: 0,
                        userSelect: 'none',
                        transition: 'box-shadow 0.2s, border-color 0.2s',
                        boxShadow: isDark ? '0 0 0 0 rgba(64,150,255,0)' : '0 1px 4px rgba(22,119,255,0.15)',
                    }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = isDark ? '0 0 0 3px rgba(64,150,255,0.35)' : '0 0 0 3px rgba(22,119,255,0.18)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = isDark ? '0 0 0 0 rgba(64,150,255,0)' : '0 1px 4px rgba(22,119,255,0.15)')}
                    >
                        {userInfo?.username
                            ? userInfo.username.charAt(0).toUpperCase()
                            : userInfo?.email
                                ? userInfo.email.charAt(0).toUpperCase()
                                : <UserOutlined style={{ fontSize: 14 }} />}
                    </div>
                </Dropdown>
            </Header>
            <Layout
                style={{ padding: '0 0 0  0' }}
            >
                <Sider
                    theme={isDark ? 'dark' : 'light'}
                    width={200}
                    collapsedWidth={0}
                    breakpoint='md'
                    trigger={null}
                    collapsible
                    collapsed={siderCollapsed}
                    style={{
                        background: siderBgColor,
                        borderInlineEnd: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #f0f0f0',
                        boxShadow: isDark ? '2px 0 10px rgba(0,0,0,0.25)' : '2px 0 10px rgba(0,0,0,0.04)',
                        zIndex: 9,
                        position: isMobileLayout ? 'fixed' : 'sticky',
                        top: 64,
                        left: 0,
                        height: 'calc(100vh - 64px)',
                        overflowY: 'auto'
                    }}
                >
                    {/* <div style={{
                        padding: '12px 16px 8px 16px',
                        color: isDark ? '#94a3b8' : '#64748b',
                        fontSize: 12,
                        letterSpacing: '0.04em'
                    }}>
                        NAVIGATION
                    </div> */}
                    <Menu
                        className='app-main-sider-menu'
                        mode="inline"
                        selectedKeys={[current]}
                        items={menus}
                        onSelect={handleMainMenuSelect}
                        style={{
                            background: 'transparent',
                            height: '100%',
                            borderInlineEnd: 0
                        }}
                    />

                </Sider>
                {/* {JSON.stringify(location)} */}
                {/* {JSON.stringify(projectObj)} */}
                <Content>
                    <div style={{ maxWidth: "1800px", margin: "1rem auto", padding: `${isSticky ? '0 16px 0 16px' : '0'}` }}>
                        <Row ref={containerRef}
                            gutter={[isSticky ? 16 : 0, 16]}>
                            <Col lg={18} sm={18} xs={24}>
                                <Suspense key={location.key} fallback={<Test></Test>}>
                                    {checkProject() ? <>
                                        <Outlet context={{ project: project_id, projectObj, messageApi }} />
                                    </> : <Empty description="Please create/select the project first" image={Empty.PRESENTED_IMAGE_SIMPLE}>
                                        <ProjectComp
                                            project_id={project_id}
                                            openModal={openModals} ></ProjectComp>

                                        {/* <Button type='primary' onClick={() => {
                                openModal("project")
                            }}>创建项目</Button> */}
                                    </Empty>}
                                </Suspense>
                            </Col>
                            <Col lg={6} sm={6} xs={24}
                                style={isMobileLayout ? {} : {
                                    position: "sticky",
                                    top: appHeaderHeight,
                                    alignSelf: "flex-start",
                                    height: sidePanelHeight,
                                    maxHeight: sidePanelHeight,
                                    minHeight: 0,
                                }}>
                                <Card
                                    size="small"
                                    title={``}
                                    style={{
                                        flex: 1,
                                        display: "flex",
                                        flexDirection: "column",
                                        height: "100%",
                                        minHeight: 0,
                                    }}
                                    styles={{
                                        body: {
                                            flex: 1,
                                            minHeight: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            overflow: 'hidden',
                                            padding: 8,
                                        }
                                    }}
                                    extra={
                                        <Segmented size="small" value={sideView}
                                            onChange={(val: any) => {
                                                // setView("analysisTools")
                                                setSideView(val)
                                            }}
                                            options={sideOptions} />
                                    }>

                                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
                                        <ViewResolver view={sideView} view_mode={"card"}></ViewResolver>
                                    </div>

                                </Card>

                            </Col>

                        </Row>
                    </div>


                </Content>
            </Layout>
            <FormProject
                params={modals.project.params}
                visible={modals.project.visible}
                onClose={() => closeModals("project")} />


            <SettingDrawer
                visible={modals.setting.visible}
                onClose={() => closeModals("setting")}
                params={modals.setting.params}
                project_id={project_id}
                openModal={openModals}
            ></SettingDrawer>
            {/* <ContextModal visible={modal.visible} onClose={closeModal} /> */}
        </Layout>



    );
};
const AppLayout: React.FC = () => {
    return <App></App>

}
export default AppLayout;

const SettingDrawer: FC<any> = ({ visible, onClose, project_id, openModal: openModal_ }) => {
    const { modal, openModal, closeModal } = useModal();
    const { analysis, tables, forms } = useComponentStore();
    const { openAsync } = useUI();
    return <Drawer title="Setting"
        extra={<>
            Version: 0.1.2
        </>}
        open={visible} onClose={onClose} >
        <Flex vertical gap={"small"}>
            {JSON.stringify(tables)}
            {JSON.stringify(analysis)}
            forms: {JSON.stringify(forms)}

            <Button onClick={() => { console.log(useComponentStore.getState().print()) }}>componentStore</Button>
            <Button onClick={() => {
                // const data = {
                //     action: "component.invoke",
                //     payload: {
                //         category: "tables",
                //         id: "tools-details",
                //         method: "reload",
                //     }
                // }
                const data = {
                    action: "component.invoke",
                    payload: {
                        category: "analysis",
                        id: "node-5362d706-3006-46d8-94f5-652209d366cc",
                        method: "analysisDone",
                        args: {
                            status: "done"
                        }
                    }
                }
                ActionDispatcher.dispatch(data.action, data.payload);
            }}>Test ActionDispatcher</Button>
            <Button onClick={async () => {
                try {
                    await openAsync({
                        type: "drawer",
                        view: "confirmDialog",
                        params: { id: 1 },
                    })
                    console.log("confirm result")

                } catch (error) {
                    console.log("confirm cancel")
                }

            }}>confirm</Button>
            <div>
                Language: <LanguageSelector></LanguageSelector>
            </div>
            <div>
                Theme: <ThemeSelector></ThemeSelector>
            </div>

            <div>
                Project: <ProjectComp project_id={project_id} openModal={openModal_}></ProjectComp>

            </div>
            <div>
                Namespace: <NamespaceSelect></NamespaceSelect>
            </div>
            {/* <div>
                <Button size="small" color="cyan" variant="solid" onClick={() => {
                    openModal("installNamespace")
                }}>Install namespace</Button>
            </div> */}
        </Flex>
        <InstallNamespace
            callback={onClose}
            visible={modal.key == "installNamespace" && modal.visible}
            onClose={closeModal}
            params={modal.params}></InstallNamespace>


    </Drawer>
}

const Markdown = lazy(() => import('@/components/markdown'));

const ApiComp: FC<any> = ({ open }) => {
    const { modal, openModal, closeModal } = useModal();
    const { baseURL, authorization, containerURL, githubToken: githubToken_, storeRepos: storeRepos_ } = useSelector((state: any) => state.user)
    const [value, setValue] = useState<any>(baseURL)
    const [auth, setAuth] = useState<any>(authorization)
    const [contURL, setContURL] = useState<any>(containerURL)
    const [githubToken, setGithubToken] = useState<any>(githubToken_)
    const [storeRepos, setStoreRepos] = useState<any>(storeRepos_)



    const dispatch = useDispatch()
    const [messageApi, messageContextHolder] = message.useMessage();

    useEffect(() => {
        if (open) {
            openModal("apiComp")
        }
    }, [open])

    return <>
        {messageContextHolder}
        <ApiOutlined style={{ cursor: "pointer" }}
            onClick={() => { openModal("apiComp") }}
        />
        <Modal
            width="40%"
            title="Edit api"
            open={modal.key == "apiComp" && modal.visible}
            onClose={closeModal}
            onCancel={closeModal}
            onOk={async () => {

                try {
                    await axios.get(`${value}/brave-api/ping`, {
                        headers: {
                            Authorization: `Bearer ${auth}`
                        }
                    })
                    dispatch(setUserItem({ baseURL: value }))
                    if (auth) {
                        dispatch(setUserItem({ authorization: `${auth}` }))

                    }
                    if (contURL) {
                        dispatch(setUserItem({ containerURL: `${contURL}` }))

                    }
                    if (githubToken) {
                        dispatch(setUserItem({ githubToken: `${githubToken}` }))
                    }
                    if (storeRepos) {
                        dispatch(setUserItem({ storeRepos: `${storeRepos}` }))
                    }
                    closeModal()
                    messageApi.success("Connection successful!")
                } catch (error) {
                    messageApi.error("Connection failed!")
                }

            }}
        >
            {(modal.key == "apiComp" && modal.visible) && <>
                <Form.Item label="API">
                    <Input value={value} onChange={(e) => setValue(e.target.value)}></Input>
                </Form.Item>
                <Tag style={{ cursor: "pointer" }} onClick={() => { setValue("https://brave-eu0y.onrender.com") }}>Test: https://brave-eu0y.onrender.com</Tag>
                <a target='_blank' href={`${value}/brave-api/ping`}>Certificate Verification</a>
                <p style={{ marginTop: 8, color: "#888", fontSize: 13 }}>
                    ⚠️ If your API uses a self-signed HTTPS certificate, the browser may show
                    a “Connection not private” or “Unsafe” warning.
                    Please click “Advanced” → “Proceed anyway” once to trust the certificate
                    before testing the connection.
                </p>
                <Form.Item label="Authorization">
                    <Input placeholder='Optional' value={auth} onChange={(e) => setAuth(e.target.value)}></Input>
                </Form.Item>
                <Form.Item label="Container URL">
                    <Input placeholder='Optional http://localhost:8089' value={contURL} onChange={(e) => setContURL(e.target.value)}></Input>
                </Form.Item>
                <Form.Item label="Github Token">
                    <Input value={githubToken} onChange={(e) => setGithubToken(e.target.value)}></Input>
                </Form.Item>
                {githubToken &&
                    <a onClick={() => {
                        setGithubToken(undefined)
                        dispatch(setUserItem({ githubToken: undefined }))
                        localStorage.removeItem('githubToken')
                    }}>Delete  Github Token </a>}


                <p style={{ marginTop: 8, color: "#888", fontSize: 13 }}>
                    when you encounter issues such as "403 Client Error: rate limit exceeded". please
                    generate a personal access token (PAT) with "repo" and "read:packages" scopes to increase the rate limit.
                    <a target='_blank' href="https://github.com/settings/tokens">Get Github Token</a>
                    <br />


                </p>
                <Form.Item label="Store Repos">
                    <TextArea value={storeRepos} onChange={(e) => setStoreRepos(e.target.value)}></TextArea>
                </Form.Item>
                <Typography>
                    <pre>
                        {JSON.stringify([{
                            "store_name": "quick-start",
                            "store_path": "pybrave",
                            "name": "Quick Start Store",
                            "address": "github"
                        }], null, 2)}
                    </pre>
                </Typography>


                <Suspense fallback={<Test></Test>}>
                    <Markdown data={`
brave  \
    --mysql-url root:123456@localhost:63306/brave \
    --port 5008                 `}></Markdown>
                </Suspense>

            </>}

        </Modal>
    </>
}

// const NamespaceSelect: FC<any> = () => {
//     const { namespace } = useSelector((state: any) => state.user);
//     const dispatch = useDispatch()
//     const { modal, openModal, closeModal } = useModal();

//     const [options, setOptions] = useState<any>([])

//     // const [namespaceList, setNamespaceList] = useState<any>([])
//     const loadNamespace = async () => {
//         const resp = await axios.get(`/list-namespace-file`)
//         const data = resp.data
//         // setNamespaceList(data)
//         setOptions(data.map((item: any) => ({
//             label: `${item.name}`,
//             value: item.namespace_id
//         })))
//     }
//     useEffect(() => {
//         loadNamespace()
//     }, [])
//     return <>

//         <Select onChange={(value: any) => {
//             dispatch(setUserItem({ namespace: value }))
//         }} options={options} value={namespace}></Select>
//         <PlusOutlined style={{ cursor: "pointer" }} onClick={() => openModal("createOrUpdateNamespace")} />

//         <CreateOrUpdateNamespace
// callback={loadNamespace}
// visible={modal.key == "createOrUpdateNamespace" && modal.visible}
// onClose={closeModal}
// params={modal.params}></CreateOrUpdateNamespace>

//     </>
// }

const NamespaceSelect: FC<any> = () => {
    const [namespace, setNamespace] = useState<any>()
    const [dataList, setdDataList] = useState<any>([])
    const [loading, setLoading] = useState(false)
    const { modal, openModal, closeModal } = useModal();
    const message = useGlobalMessage()
    const loadData = async () => {
        const resp: any = await axios.get("/list-namespace")
        // console.log(resp.data)
        const dataList = resp.data.map((item: any) => {
            return {
                label: `${item.name}`,
                value: item.namespace_id
            }
        })
        setdDataList(dataList)
    }
    const loadUsedNamespace = async () => {
        setLoading(true)
        const resp: any = await axios.get("/get-used-namespace")
        // console.log(resp.data)
        setNamespace(resp.data)
        setLoading(false)
    }
    useEffect(() => {
        loadUsedNamespace()
        loadData()
    }, [])
    return <>
        {/* {JSON.stringify(namespace)} */}


        <Select
            loading={loading}
            size='small'

            // open={true}
            dropdownRender={(menu) => <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Flex gap={"small"} justify={"space-between"} >
                    <Button type='text' size="small" color="cyan" variant='solid' onClick={() => {
                        openModal("namespace")
                    }}>Create</Button>
                    <Button type='text' size="small" color="cyan" variant='solid' onClick={() => {
                        loadData()
                    }}>Refresh</Button>
                </Flex>

                {namespace?.namespace_id && (
                    <>
                        <Divider style={{ margin: '8px 0' }} />
                        <Tooltip title={namespace.namespace_id} placement='bottom'>

                            <Flex gap={"small"} justify={"space-between"} >

                                <Button type='text' size="small" color="cyan" variant='solid' onClick={() => {
                                    openModal("namespace", { namespace_id: namespace.namespace_id })
                                }}>Update</Button>
                                <Popconfirm title="Are you sure about the deletion?" onConfirm={async () => {
                                    await axios.delete(`/delete-namespace-by-id/${namespace.namespace_id}`)
                                    message.success("successfully delete")
                                    loadData()
                                }}>
                                    <Button type='text' size="small" color="danger" variant='solid' >Delete</Button>
                                </Popconfirm>

                            </Flex>
                        </Tooltip>

                    </>)}
            </>}
            onChange={async (value: any) => {
                console.log("onChange", value)
                // dispatch(setUserItem({ namespace: value }))
                setLoading(true)
                await axios.post(`/set-used-namespace/${value}`)
                await loadUsedNamespace()
                setLoading(false)
                message.success(`Switching Namespaces: ${value}`)
            }}
            value={namespace?.namespace_id}
            style={{ width: 130 }}
            placeholder="Select Namespace"
            options={dataList}
        >
        </Select>

        <CreateOrUpdateNamespace
            callback={loadData}
            visible={modal.key == "namespace" && modal.visible}
            onClose={closeModal}
            params={modal.params}
        ></CreateOrUpdateNamespace>
    </>
}
const ProjectComp: FC<any> = ({ }) => {
    const [projectList, setProjectList] = useState<any>([])
    const dispatch = useDispatch()
    const message = useGlobalMessage()
    const { modal, openModal, closeModal } = useModal();
    const { project: project_id } = useSelector((state: any) => state.user);

    const loadProject = async () => {
        const resp: any = await axios.get("/project/list-project")
        // console.log(resp.data)
        const projectList = resp.data.map((item: any) => {
            return {
                label: `${item.project_name}`,
                value: item.project_id
            }
        })
        setProjectList(projectList)

        // const projectMap = resp.data.reduce((acc: any, item: any) => {
        //     acc[item.project_id] = item
        //     // item.metadata_form = JSON.parse(item.metadata_form)
        //     return acc
        // }, {})
        // setProjectMap(projectMap)
        // setProjectObj(projectMap[project_id])
    }
    useEffect(() => {
        loadProject()
    }, [])
    return <>

        <Select
            size='small'
            // open={true}
            dropdownRender={(menu) => <>
                {menu}
                <Divider style={{ margin: '8px 0' }} />
                <Flex gap={"small"} justify={"space-between"} >
                    <Button type='text' size="small" color="cyan" variant='solid' onClick={() => {
                        openModal("project")
                    }}>Create</Button>
                    <Button type='text' size="small" color="cyan" variant='solid' onClick={() => {
                        loadProject()
                    }}>Refresh</Button>
                </Flex>

                {project_id && (
                    <>
                        <Divider style={{ margin: '8px 0' }} />
                        <Tooltip title={project_id} placement='bottom'>

                            <Flex gap={"small"} justify={"space-between"} >

                                <Button type='text' size="small" color="cyan" variant='solid' onClick={() => {
                                    openModal("project", { project_id: project_id })
                                }}>Update</Button>
                                <Popconfirm title="Are you sure about the deletion?" onConfirm={async () => {
                                    await deleteProjectApi(project_id)
                                    message.success("successfully delete")
                                    // dispatch(setProject({

                                    // }))
                                    loadProject()
                                }}>
                                    <Button type='text' size="small" color="danger" variant='solid' >Delete</Button>
                                </Popconfirm>

                            </Flex>
                        </Tooltip>

                    </>)}
            </>}
            onChange={(value: any) => {
                console.log("onChange", value)

                dispatch(setUserItem({ project: value }))
                message.success(`Switching Project: ${value}`)
                // setProjectObj(projectMap[value])
                // loadProject()
            }}
            value={project_id}
            style={{ width: 130 }}
            placeholder="Select Project"
            options={projectList}
        >
        </Select>

        <FormProject
            callback={loadProject}
            visible={modal.key == "project" && modal.visible}
            onClose={closeModal}
            params={modal.params} />
        {/* <PlusOutlined style={{ cursor: "pointer" }} onClick={() => {
            openModal("project")
        }} /> */}
    </>
}