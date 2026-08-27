import { Card, Col, Menu, MenuProps, Row, Skeleton, theme, Tree, TreeDataNode, TreeProps } from "antd";
import { FC, lazy, Suspense, useEffect, useRef, useState } from "react";
import { DownOutlined, LaptopOutlined, NotificationOutlined, UserOutlined } from '@ant-design/icons'





export const viewMapping: {
    key: string;
    label: string;
    component: React.ComponentType<any>;
}[] = [
        // { key: "kegg", label: "kegg", component:  },

    ];

export const ComponentsRender: FC<{ view: string }> = ({ view }) => {
    if (!view) return <div >未知类型</div>;
    const item = viewMapping.find((v) => v.key === view);
    if (!item) return <div>未知类型{view}</div>;
    const { component: Component, key, ...rest } = item
    // const Component = item.component;

    return <Suspense fallback={<Skeleton active></Skeleton>}>

        <Component  {...rest} />
    </Suspense>
};

const LeftPanel: FC<any> = ({ treeData, defaultSelectKey, onSelect: onSelect_ }) => {


    const [selectedKey, setSelectedKey] = useState<any>(defaultSelectKey)

    const onSelect: TreeProps['onSelect'] = (selectedKeys, info) => {
        // console.log('selected', selectedKeys, info);
        if (selectedKeys.length > 0) {
            onSelect_(info)
            setSelectedKey(selectedKeys[0])
        }

    };

    return (
        <>
            {/* {defaultSelectKey} */}
            <Tree
                selectedKeys={[selectedKey]}
                showLine
                switcherIcon={<DownOutlined />}
                defaultExpandAll
                // defaultExpandedKeys={['0-0-0']}
                onSelect={onSelect}
                treeData={treeData}
            />
        </>
    );
}

const ToolKit: FC<any> = () => {
    const [view, setView] = useState<string>("kegg")
    const treeData2 = [
        {
            title: 'Databases',
            key: '0-0',
            children: [
                {
                    title: 'kegg',
                    key: 'kegg',
                    type: "btn",
                }, {
                    title: 'metacyc',
                    key: 'metacyc',
                    type: "btn",
                }
            ],
        }
    ];
    return <div style={{ margin: "1rem  1rem 0 1rem" }}>

        {/* <div style={{ marginBottom: "1rem" }}></div> */}

        <Row>
            <Col lg={4} sm={4} xs={24} >
                <Card
                    size="small"
                >
                    <LeftPanel onSelect={(val: any) => {
                        if (val.node.type == "btn") {
                            console.log(val)
                            setView(val.node.key)
                        }


                    }} defaultSelectKey={view} treeData={treeData2}></LeftPanel>

                </Card>


            </Col>
            <Col lg={20} sm={20} xs={24} style={{ paddingLeft: "1rem" }}>

                <ComponentsRender view={view}></ComponentsRender>
            </Col>
        </Row>
    </div>
}

// export default ToolKit

import { Layout, Button } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import React from "react";
import { useSelector } from "react-redux";

const { Sider, Content } = Layout;

const MyLayout = () => {
    const { theme } = useSelector((state: any) => state.user); // 'light' | 'dark'

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#001529' : '#fff'; // 深色/白色
    const textColor = isDark ? '#fff' : '#000';

    const containerRef = useRef<HTMLDivElement>(null);
    const [innerHeight, setInnerHeight] = useState<any>(null);
    const [headerHeight, setHeaderHeight] = useState<any>(null);
    const updateHeight = () => {
        if (containerRef.current) {
            const height = containerRef.current.getBoundingClientRect().top // 包含 padding
            setHeaderHeight(height)
            setInnerHeight(window.innerHeight - height);
        }
    }
    useEffect(() => {
        updateHeight(); // 初始化
        window.addEventListener("resize", updateHeight);
        // window.addEventListener("scroll", updateHeight);
        return () => {
            window.removeEventListener("resize", updateHeight);
            //   window.removeEventListener("scroll", updateHeight);
        };
    }, []);
    const [collapsed, setCollapsed] = useState(false);
    const [view, setView] = useState("kegg");

    const treeData2 = [
        {
            label: 'Databases',
            key: 'databases',
            children: [
                {
                    label: 'kegg',
                    key: 'kegg',
                }, {
                    label: 'metacyc',
                    key: 'metacyc',

                }
            ],
        }
    ];
    

    const siderStyle: React.CSSProperties = {
        overflow: 'auto',
        height: `${innerHeight}px`,
        position: 'sticky',
        insetInlineStart: 0,
        top:`${headerHeight}px`,
        bottom: 0,
        // background: bgColor,
        // color: textColor,
        scrollbarWidth: 'thin',
        scrollbarGutter: 'stable',
        boxShadow: '0 1px 4px rgba(0,0,0,0.1)',

    };
    return (
        <Layout ref={containerRef}>
            <Sider theme={theme} style={siderStyle} collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}  >
                <Menu

                    mode="inline"
                    // defaultSelectedKeys={['1']}
                    defaultOpenKeys={['databases']}
                    // style={{ height: '100%', borderInlineEnd: 0 }}
                    style={{ flex: 1, minWidth: 0, background: 'transparent', border: 0 }}
                    items={treeData2}
                    selectedKeys={[view]}
                    onSelect={k => {
                        console.log(k.key)
                        setView(k.key)
                    }}
                />
            </Sider>
            <Layout style={{ }}>
                {/* <Breadcrumb
            items={[{ title: 'Home' }, { title: 'List' }, { title: 'App' }]}
            style={{ margin: '16px 0' }}
          /> */}
                <Content
                    style={{
                        padding: "1rem",
                        margin: 0,
                      
                    }}
                >
                    <ComponentsRender view={view}></ComponentsRender>

                </Content>
            </Layout>
        </Layout>
    );
};

export default MyLayout;