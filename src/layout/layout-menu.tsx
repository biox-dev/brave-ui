import type { ReactNode } from 'react';
import {
  AppstoreOutlined,
  CodeOutlined,
  CompassOutlined,
  ContainerOutlined,
  DashboardOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  ReadOutlined,
  RobotOutlined,
  SettingOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import project from '@/pages/project';

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
  summary: <FileDoneOutlined />,
  container: <ContainerOutlined />,
  code: <CodeOutlined />,
  agent: <RobotOutlined />,
  setting: <SettingOutlined />,
};

const resolveMenuIcon = (iconName?: string) => {
  if (!iconName) return undefined;
  return iconRegistry[iconName] ?? <AppstoreOutlined />;
};

export const layoutMenuTree: LayoutMenuItem[] = [
  // {
  //   key: '/',
  //   icon: 'dashboard',
  //   label: {
  //     zh_CN: '报告撰写',
  //     en_US: 'Report Writing',
  //   },
  // },
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
  
  // {
  //   key: '/analysis-report',
  //   icon: 'report',
  //   label: {
  //     zh_CN: '分析报告',
  //     en_US: 'Report',
  //   },
  // },
  // {
  //   key: '/files',
  //   icon: 'files',
  //   label: {
  //     zh_CN: '文件',
  //     en_US: 'Files',
  //   },
  // },
  {
    key: '/dataset',
    icon: 'files',
    label: {
      zh_CN: '数据集',
      en_US: 'Datasets',
    },
  },
  {
    key: '/assay-project',
    icon: 'files',
    label: {
      zh_CN: '实验/建库',
      en_US: 'Assays',
    },
  },
  {
    key: '/ai-summary',
    icon: 'summary',
    label: {
      zh_CN: 'AI 摘要',
      en_US: 'AI Summary',
    },
  },
  // 「应用会话」不再作为独立路由：已并入左侧栏「容器模板」堆叠视图
  // （container-template-stack 的 appSessionPage 分栏）。
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
        key: '/container-template',
        icon: 'container',
        label: {
          zh_CN: '容器模板',
          en_US: 'Container Template',
        },
      },
      {
        key: '/container-template-spec',
        icon: 'container',
        label: {
          zh_CN: '容器运行配置',
          en_US: 'Container Template Spec',
        },
      },
      // 「容器运行时」只在 container.docker.provision.enabled=true 时出现，
      // 由 buildLayoutMenus 的 filter 按 redux 里的 runtimeInfo 实时过滤。
      {
        key: '/container-runtime-provision',
        icon: 'container',
        label: {
          zh_CN: '容器运行时',
          en_US: 'Container Runtime',
        },
      },
    ],
  },
  {
    key: '/config',
    icon: 'setting',
    label: {
      zh_CN: '可视化配置',
      en_US: 'Config',
    },
  },
  {
    key: '/agent',
    icon: 'agent',
    label: {
      zh_CN: 'Agent 管理',
      en_US: 'Agent',
    },
    children: [
      {
        key: '/agent-task',
        icon: 'agent',
        label: {
          zh_CN: 'Agent 任务',
          en_US: 'Agent Tasks',
        },
      },
      {
        key: '/agent-permission',
        icon: 'agent',
        label: {
          zh_CN: 'Agent 权限',
          en_US: 'Agent Permissions',
        },
      },
      {

        key: '/agent-skill',
        icon: 'agent',
        label: {
          zh_CN: 'Agent 技能',
          en_US: 'Agent Skills',
        },
      }, {
        key: '/agent-tool',
        icon: 'agent',
        label: {
          zh_CN: 'Agent 工具',
          en_US: 'Agent Tools',
        },
      }, {        key: '/agent-profile',
        icon: 'agent',
        label: {
          zh_CN: 'Agent Profile',
          en_US: 'Agent Profiles',
        },
      }, {
        key: '/agent-memory',
        icon: 'agent',
        label: {
          zh_CN: 'Agent 记忆',
          en_US: 'Agent Memory',
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

/**
 * 菜单可见性钩子：返回 true 表示该菜单项可见。
 *
 * 用于按运行时配置动态隐藏入口（例如 container.docker.provision.enabled=false 时不展示
 * 「容器运行时」安装向导）。未提供时全部可见。子项被过滤后，空掉的父级也会一并隐藏。
 */
export type LayoutMenuFilter = (item: LayoutMenuItem) => boolean;

export const buildLayoutMenus = (
  locale: LayoutLocale,
  filter?: LayoutMenuFilter,
): MenuProps['items'] => {
  const toMenuItems = (items: LayoutMenuItem[]): MenuProps['items'] => {
    return items
      .filter((item) => !item.hidden && (filter ? filter(item) : true))
      .map((item) => {
        const children = item.children ? toMenuItems(item.children) : undefined;
        // 父级原本有子项，但全部被子级过滤掉时，父级也没有可点的入口，直接隐藏。
        if (item.children && item.children.length > 0 && (!children || children.length === 0)) {
          return null;
        }
        return {
          key: item.key,
          icon: resolveMenuIcon(item.icon),
          label: item.label[locale],
          ...(children && children.length > 0 ? { children } : {}),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
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