import type { ReactNode } from 'react';
import {
  AppstoreOutlined,
  CodeOutlined,
  CompassOutlined,
  ContainerOutlined,
  DashboardOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  ReadOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

export type LayoutLocale = 'zh_CN' | 'en_US';

export type LayoutMenuItem = {
  key: string;
  icon?: string;
  label: {
    zh_CN: string;
    en_US: string;
  };
  children?: LayoutMenuItem[];
  hidden?: boolean;
};

type SelectedKeyMapItem = {
  key: string;
  selectedKey: string;
};

const iconRegistry: Record<string, ReactNode> = {
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

export const layoutMenuTree: LayoutMenuItem[] = [
  {
    key: '/',
    icon: 'dashboard',
    label: {
      zh_CN: '仪表盘',
      en_US: 'Dashboard',
    },
  },
  // {
  //   key: '/c/scripts',
  //   icon: 'code',
  //   label: {
  //     zh_CN: '脚本',
  //     en_US: 'Scripts',
  //   },
  // },
  // {
  //   key: '/c/tools',
  //   icon: 'tools',
  //   label: {
  //     zh_CN: '工具',
  //     en_US: 'Tools',
  //   },
  // }, 
  
  {
    key: '/analysis-report',
    icon: 'report',
    label: {
      zh_CN: '分析报告',
      en_US: 'Report',
    },
  },
  {
    key: '/files',
    icon: 'files',
    label: {
      zh_CN: '文件',
      en_US: 'Files',
    },
  },
  {
    key: '/app-session',
    icon: 'container',
    label: {
      zh_CN: '应用会话',
      en_US: 'App Session',
    },
  },

  {
    key: '/container',
    icon: 'container',
    label: {
      zh_CN: '容器管理',
      en_US: 'Container',
    },
    children: [
      {
        key: '/container-instance',
        icon: 'container',
        label: {
          zh_CN: '容器实例',
          en_US: 'Container Instance',
        },
      },
      {
        key: '/outbox-event',
        icon: 'container',
        label: {
          zh_CN: '出箱事件',
          en_US: 'Outbox Event',
        },
      },
      {
        key: '/container-image',
        icon: 'container',
        label: {
          zh_CN: '容器镜像',
          en_US: 'Container Image',
        },
      },
      {
        key: '/container-template',
        icon: 'container',
        label: {
          zh_CN: '容器模板',
          en_US: 'Container Template',
        },
      },
    ],
  },
  {
    key: '/more',
    icon: 'apps',
    label: {
      zh_CN: '更多',
      en_US: 'More',
    },
    children: [
      {
        key: '/explore',
        icon: 'explore',
        label: {
          zh_CN: '探索',
          en_US: 'Explore',
        },
      },
      {
        key: '/tasks',
        icon: 'apps',
        label: {
          zh_CN: '任务',
          en_US: 'Tasks',
        },
      },
      {
        key: '/c/file',
        icon: 'files',
        label: {
          zh_CN: '文件',
          en_US: 'Files',
        },
      },
      {
        key: '/componentsV2/file',
        icon: 'files',
        label: {
          zh_CN: '文件',
          en_US: 'Files',
        },
      },
      {
        key: '/container-page',
        icon: 'container',
        label: {
          zh_CN: '容器管理(deprecated)',
          en_US: 'Container(deprecated)',
        },
      },
      {
        key: '/interactive-tools',
        icon: 'tools',
        label: {
          zh_CN: '交互工具',
          en_US: 'Interactive Tools',
        },
      },
      {
        key: '/tool-kit',
        icon: 'tools',
        label: {
          zh_CN: '工具集',
          en_US: 'TookKit',
        },
      },
      {
        key: '/literature',
        icon: 'literature',
        label: {
          zh_CN: '文献资料',
          en_US: 'Literature',
        },
      },
      {
        key: '/componentsV2/script',
        icon: 'code',
        label: {
          zh_CN: '脚本',
          en_US: 'Scripts',
        },
      },
      {
        key: '/tools-card',
        label: {
          zh_CN: '工具-old',
          en_US: 'Tools-old',
        },
        children: [
          {
            key: '/relation/tools',
            hidden: true,
            label: {
              zh_CN: 'Tools Relation',
              en_US: 'Tools Relation',
            },
          },
        ],
      },
      {
        key: '/analysis-report-old',
        label: {
          zh_CN: '分析报告(old)',
          en_US: 'Report(old)',
        },
      },
      {
        key: '/file-card',
        label: {
          zh_CN: '文件(deprecated)',
          en_US: 'File(deprecated)',
        },
        children: [
          {
            key: '/component/file',
            hidden: true,
            label: {
              zh_CN: 'File Component',
              en_US: 'File Component',
            },
          },
        ],
      },
      {
        key: '/pipeline-card',
        label: {
          zh_CN: '分析流程(deprecated)',
          en_US: 'Workflows(deprecated)',
        },
        children: [
          {
            key: '/component/pipeline',
            hidden: true,
            label: {
              zh_CN: 'Pipeline Component',
              en_US: 'Pipeline Component',
            },
          },
        ],
      },
      {
        key: '/software-card',
        label: {
          zh_CN: '工具(deprecated)',
          en_US: 'Tools(deprecated)',
        },
        children: [
          {
            key: '/component/software',
            hidden: true,
            label: {
              zh_CN: 'Software Component',
              en_US: 'Software Component',
            },
          },
        ],
      },
      {
        key: '/script-card',
        label: {
          zh_CN: '可视化(deprecated)',
          en_US: 'Visualization(deprecated)',
        },
        children: [
          {
            key: '/component/script',
            hidden: true,
            label: {
              zh_CN: 'Script Component',
              en_US: 'Script Component',
            },
          },
        ],
      },
    ],
  },
  {
    key: '/literature-intelligence',
    icon: 'literature',
    label: {
      zh_CN: '文献情报',
      en_US: 'Literature Intelligence',
    },
  },
];

export const buildLayoutMenus = (locale: LayoutLocale): MenuProps['items'] => {
  const toMenuItems = (items: LayoutMenuItem[]): MenuProps['items'] => {
    return items
      .filter((item) => !item.hidden)
      .map((item) => {
        const children = item.children ? toMenuItems(item.children) : undefined;
        return {
          key: item.key,
          icon: resolveMenuIcon(item.icon),
          label: item.label[locale],
          ...(children && children.length > 0 ? { children } : {}),
        };
      });
  };

  return toMenuItems(layoutMenuTree);
};

export const buildSelectedKeyMap = (menus: LayoutMenuItem[]): SelectedKeyMapItem[] => {
  const map: SelectedKeyMapItem[] = [];

  const traverse = (items: LayoutMenuItem[], parentKey?: string) => {
    for (const item of items) {
      const mappedKey = item.hidden && parentKey ? parentKey : item.key;
      map.push({ key: item.key, selectedKey: mappedKey });

      if (item.children) {
        traverse(item.children, mappedKey);
      }
    }
  };

  traverse(menus);
  map.sort((a, b) => b.key.length - a.key.length);
  return map;
};

export const resolveSelectedKey = (pathname: string, selectedKeyMap: SelectedKeyMapItem[]): string => {
  for (const item of selectedKeyMap) {
    if (pathname.startsWith(item.key)) {
      return item.selectedKey;
    }
  }
  return '/';
};