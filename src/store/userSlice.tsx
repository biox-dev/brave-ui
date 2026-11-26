import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { getActiveProjectApi } from '@/api/project'
import { getContainerRuntimeInfoApi, type ContainerRuntimeHealth } from '@/api/container'
import { getCurrentUserApi, type AgentProfileInfo, type AgentUserConfig, type UserMenuConfig } from '@/api/auth'
import { getPathname } from "@/utils/utils";

const locale = localStorage.getItem('locale')
const theme = localStorage.getItem('theme')
const baseURL = localStorage.getItem('baseURL')
const authorization = localStorage.getItem('Authorization') || localStorage.getItem('authorization')
const refreshToken = localStorage.getItem('RefreshToken')
const containerURL = localStorage.getItem('containerURL')
const namespace = localStorage.getItem('namespace')
const githubToken = localStorage.getItem('githubToken')
const storeRepos = localStorage.getItem('storeRepos')
const scmOrigin = localStorage.getItem('scmOrigin')
const activeProjectReportId = localStorage.getItem('activeProjectReportId')
const activeLLMSessionId = localStorage.getItem('activeLLMSessionId')
const leftPanelWidth = Number(localStorage.getItem('leftPanelWidth'))
const leftMiddlePanelWidth = Number(localStorage.getItem('leftMiddlePanelWidth'))
const assistantPanelWidth = Number(localStorage.getItem('assistantPanelWidth'))
const rightPanelWidth = Number(localStorage.getItem('rightPanelWidth'))
// 左侧面板是否折叠隐藏
const leftPanelCollapsed = localStorage.getItem('leftPanelCollapsed') === 'true'
// 右侧面板（参数面板）是否折叠隐藏
const rightPanelCollapsed = localStorage.getItem('rightPanelCollapsed') === 'true'
const leftActivityKey = localStorage.getItem('leftActivityKey')
const sideView = localStorage.getItem('sideView')

// 左侧栏纵向堆叠视图的折叠状态：{ [stackKey]: collapsedSectionKeys[] }
const parseLeftStackCollapsed = (): Record<string, string[]> => {
    try {
        const raw = localStorage.getItem('leftStackCollapsed')
        if (!raw) {
            return {}
        }
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {}
        }
        return Object.fromEntries(
            Object.entries(parsed).map(([key, value]) => [
                key,
                Array.isArray(value)
                    ? value.filter((item): item is string => typeof item === 'string')
                    : [],
            ])
        )
    } catch {
        return {}
    }
}
const leftStackCollapsed = parseLeftStackCollapsed()

// 左侧栏纵向堆叠视图的分区显示状态：{ [stackKey]: visibleSectionKeys[] }
// 未配置表示全部显示；配置为 [] 表示用户显式隐藏了整个堆叠面板。
const parseLeftStackVisibleSections = (): Record<string, string[]> => {
    try {
        const raw = localStorage.getItem('leftStackVisibleSections')
        if (!raw) {
            return {}
        }
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return {}
        }
        return Object.fromEntries(
            Object.entries(parsed).map(([key, value]) => [
                key,
                Array.isArray(value)
                    ? value.filter((item): item is string => typeof item === 'string')
                    : [],
            ])
        )
    } catch {
        return {}
    }
}
const leftStackVisibleSections = parseLeftStackVisibleSections()

/**
 * 数据集浏览器（layout-sider/data-dataset-page）当前所在路径的快照。
 *
 * 只保留恢复面包屑与文件列表所需的字段；文件列表仍按 `id` 重新拉取。
 */
export interface DatasetPathInfo {
    id: string;
    dataset_name?: string;
    description?: string;
    metadata?: string;
}

// 数据集浏览器当前进入的数据集（刷新 / 切换左侧面板后恢复）
const parseDatasetPath = (): DatasetPathInfo | null => {
    try {
        const raw = localStorage.getItem('datasetProjectPath')
        if (!raw) {
            return null
        }
        const parsed = JSON.parse(raw) as DatasetPathInfo | null
        return parsed && typeof parsed.id === 'string' && parsed.id ? parsed : null
    } catch {
        return null
    }
}
const datasetPath = parseDatasetPath()

export const loadActiveProject = createAsyncThunk(
    'user/loadActiveProject',
    async (_, { rejectWithValue }) => {
        try {
            const resp = await getActiveProjectApi()
            return resp.data
        } catch (error) {
            return rejectWithValue(null)
        }
    }
)

export const loadCurrentUser = createAsyncThunk(
    'user/loadCurrentUser',
    async (_, { rejectWithValue }) => {
        try {
            const resp = await getCurrentUserApi()
            return resp.data.data.user
        } catch (error) {
            return rejectWithValue(null)
        }
    }
)

/**
 * 拉取容器运行时环境信息（宿主 OS / 架构、连接地址、健康状态）。
 *
 * 与 loadCurrentUser 相互独立：运行时探测失败只影响 runtimeInfo，不影响登录态。
 */
export const loadRuntimeInfo = createAsyncThunk(
    'user/loadRuntimeInfo',
    async (_, { rejectWithValue }) => {
        try {
            const resp = await getContainerRuntimeInfoApi()
            // http 未做响应解包：后端直接返回 RuntimeHealth 本体。
            const payload = (resp as any)?.data ?? resp
            return payload as ContainerRuntimeHealth
        } catch (error: any) {
            const message =
                error?.response?.data?.error?.message || error?.message || 'runtime check failed'
            return rejectWithValue({
                name: '',
                registered: false,
                healthy: false,
                checkable: false,
                error: message,
            } as ContainerRuntimeHealth)
        }
    }
)

export interface LoginUserInfo {
    id: string;
    username: string;
    email: string;
    avatar: string;
    profile?: string;
    agent_config?: AgentUserConfig;
    /** 当前激活项目下的菜单配置（底部面板），由布局层回填。 */
    menu_config?: UserMenuConfig;
    /** 当前 agent_config.profile_id 对应的 Profile 摘要（由 /auth/me 解析返回）。 */
    agent_profile?: AgentProfileInfo;
    is_active: boolean;
    can_access_all_tenants: boolean;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

interface UserState {
    locale: string;
    theme:string;
    baseURL:string;
    authorization:string|null;
    refreshToken:string|null;
    containerURL:string;
    namespace:string;
    projectObj:any;
    project:any;
    githubToken:any;
    storeRepos:any;
    scmOrigin:any;
    activeProjectReportId:string | null;
    activeLLMSessionId:string | null;
    llmEnv:any;
    leftPanelWidth:number;
    leftMiddlePanelWidth:number;
    assistantPanelWidth:number;
    rightPanelWidth:number;
    /** 左侧面板是否折叠隐藏 */
    leftPanelCollapsed:boolean;
    /** 右侧面板是否折叠隐藏 */
    rightPanelCollapsed:boolean;
    leftActivityKey:string;
    sideView:string;
    /** 左侧栏堆叠视图折叠状态：{ [stackKey]: collapsedSectionKeys[] }。 */
    leftStackCollapsed: Record<string, string[]>;
    /** 左侧栏堆叠视图分区显示状态：{ [stackKey]: visibleSectionKeys[] }（未配置表示全部显示）。 */
    leftStackVisibleSections: Record<string, string[]>;
    /** 数据集浏览器当前所在路径（进入的数据集快照）。 */
    datasetPath: DatasetPathInfo | null;
    userInfo: LoginUserInfo | null;
    /** 容器运行时环境信息（来自 /container/runtime/info，页面刷新时拉取一次）。 */
    runtimeInfo: ContainerRuntimeHealth | null;
    /** 运行时信息是否正在检测中。 */
    runtimeLoading: boolean;
    componentLayout:"simple"|"complex",
    network:"UNKNOW" | "CONNECT" | "NOT_CONNECT"

    
}
const contextSlice = createSlice({
    name: 'user',
    initialState: {
        locale: locale
            ? locale  // 如果存在，从 localStorage 解析
            : 'en_US',
        theme:theme?theme:"light",
        baseURL:baseURL?`${baseURL}`:getPathname(),
        containerURL:containerURL?`${containerURL}`:getPathname(),
        authorization:authorization,
        refreshToken:refreshToken,
        namespace:namespace?`${namespace}`:`default`,
        projectId:"",
        project:{},
        githubToken:githubToken,
        storeRepos:storeRepos?storeRepos:"[]",
        activeProjectReportId:activeProjectReportId?activeProjectReportId:null,
        activeLLMSessionId:activeLLMSessionId?activeLLMSessionId:null,
        llmEnv:null,
        leftPanelWidth:Number.isFinite(leftPanelWidth)?leftPanelWidth:320,
        leftMiddlePanelWidth:Number.isFinite(leftMiddlePanelWidth)?leftMiddlePanelWidth:360,
        assistantPanelWidth:Number.isFinite(assistantPanelWidth)?assistantPanelWidth:360,
        rightPanelWidth:Number.isFinite(rightPanelWidth)?rightPanelWidth:360,
        leftPanelCollapsed,
        rightPanelCollapsed,
        leftActivityKey:leftActivityKey?leftActivityKey:'agentSessionStack',
        sideView:sideView?sideView:'agentChat',
        leftStackCollapsed,
        leftStackVisibleSections,
        datasetPath,
        userInfo: null as LoginUserInfo | null,
        runtimeInfo: null as ContainerRuntimeHealth | null,
        runtimeLoading: false,
        componentLayout:"simple",
        network:"UNKNOW",
        scmOrigin:scmOrigin?scmOrigin:"github"
    },
    reducers: {
        setUserItem(state, action: PayloadAction<Partial<UserState>>) {
            Object.assign(state, action.payload);
            if (action.payload.locale) {
                localStorage.setItem('locale', action.payload.locale)
            }
            if(action.payload.theme){
                localStorage.setItem('theme', action.payload.theme)
            }
            if(action.payload.baseURL){
                localStorage.setItem('baseURL', action.payload.baseURL)
            }
            if(action.payload.authorization !== undefined){
                if(action.payload.authorization){
                    localStorage.setItem('Authorization', action.payload.authorization)
                } else {
                    localStorage.removeItem('Authorization')
                }
                // 兼容旧版本遗留 key，统一清理小写键
                localStorage.removeItem('authorization')
            }
            if(action.payload.refreshToken !== undefined){
                if(action.payload.refreshToken){
                    localStorage.setItem('RefreshToken', action.payload.refreshToken)
                } else {
                    localStorage.removeItem('RefreshToken')
                }
            }
            if(action.payload.containerURL){
                localStorage.setItem('containerURL', action.payload.containerURL)
            }
            if(action.payload.namespace){
                localStorage.setItem('namespace', action.payload.namespace)
            }
            if(action.payload.githubToken){
                localStorage.setItem('githubToken', action.payload.githubToken)
            }
            if(action.payload.storeRepos){
                localStorage.setItem('storeRepos', action.payload.storeRepos)
            }
            if(action.payload.componentLayout){
                localStorage.setItem('componentLayout', action.payload.componentLayout)
            }
            if(action.payload.scmOrigin){
                localStorage.setItem('scmOrigin', action.payload.scmOrigin)
            }
            if (action.payload.activeProjectReportId !== undefined) {
                if (action.payload.activeProjectReportId) {
                    localStorage.setItem('activeProjectReportId', action.payload.activeProjectReportId)
                } else {
                    localStorage.removeItem('activeProjectReportId')
                }
            }
            if (action.payload.activeLLMSessionId !== undefined) {
                if (action.payload.activeLLMSessionId) {
                    localStorage.setItem('activeLLMSessionId', action.payload.activeLLMSessionId)
                } else {
                    localStorage.removeItem('activeLLMSessionId')
                }
            }
            if (action.payload.leftPanelWidth !== undefined) {
                localStorage.setItem('leftPanelWidth', String(action.payload.leftPanelWidth))
            }
            if (action.payload.leftMiddlePanelWidth !== undefined) {
                localStorage.setItem('leftMiddlePanelWidth', String(action.payload.leftMiddlePanelWidth))
            }
            if (action.payload.assistantPanelWidth !== undefined) {
                localStorage.setItem('assistantPanelWidth', String(action.payload.assistantPanelWidth))
            }
            if (action.payload.rightPanelWidth !== undefined) {
                localStorage.setItem('rightPanelWidth', String(action.payload.rightPanelWidth))
            }
            if (action.payload.leftPanelCollapsed !== undefined) {
                localStorage.setItem('leftPanelCollapsed', String(action.payload.leftPanelCollapsed))
            }
            if (action.payload.rightPanelCollapsed !== undefined) {
                localStorage.setItem('rightPanelCollapsed', String(action.payload.rightPanelCollapsed))
            }
            if (action.payload.leftActivityKey !== undefined) {
                localStorage.setItem('leftActivityKey', action.payload.leftActivityKey)
            }
            if (action.payload.leftStackCollapsed !== undefined) {
                localStorage.setItem('leftStackCollapsed', JSON.stringify(action.payload.leftStackCollapsed))
            }
            if (action.payload.leftStackVisibleSections !== undefined) {
                localStorage.setItem('leftStackVisibleSections', JSON.stringify(action.payload.leftStackVisibleSections))
            }
            if (action.payload.datasetPath !== undefined) {
                if (action.payload.datasetPath) {
                    localStorage.setItem('datasetProjectPath', JSON.stringify(action.payload.datasetPath))
                } else {
                    localStorage.removeItem('datasetProjectPath')
                }
            }
            if (action.payload.sideView !== undefined) {
                if (action.payload.sideView) {
                    localStorage.setItem('sideView', action.payload.sideView)
                } else {
                    localStorage.removeItem('sideView')
                }
            }
            // userInfo 不再持久化到 localStorage，刷新时由 loadCurrentUser 从后台获取
            // debugger
        },
        clearUserSession(state) {
            state.authorization = null;
            state.refreshToken = null;
            state.userInfo = null;
            state.runtimeInfo = null;
            state.runtimeLoading = false;
            state.projectId = "";
            state.project = {};
            state.activeLLMSessionId = null;
            state.datasetPath = null;
            localStorage.removeItem('Authorization');
            localStorage.removeItem('authorization');
            localStorage.removeItem('RefreshToken');
            localStorage.removeItem('activeProjectReportId');
            localStorage.removeItem('activeLLMSessionId');
            localStorage.removeItem('datasetProjectPath');
        },
    },
    extraReducers: (builder) => {
        builder.addCase(loadActiveProject.fulfilled, (state, action) => {
            const nextProjectId = action.payload?.project_id || "";
            // 切换项目后上次的数据集不再属于当前项目，清空浏览路径。
            if (state.projectId && nextProjectId && state.projectId !== nextProjectId && state.datasetPath) {
                state.datasetPath = null;
                localStorage.removeItem('datasetProjectPath');
            }
            state.projectId = nextProjectId;
            state.project = action.payload || {};
        });
        builder.addCase(loadCurrentUser.fulfilled, (state, action) => {
            state.userInfo = action.payload || null;
        });
        builder.addCase(loadRuntimeInfo.pending, (state) => {
            state.runtimeLoading = true;
        });
        builder.addCase(loadRuntimeInfo.fulfilled, (state, action) => {
            state.runtimeLoading = false;
            state.runtimeInfo = action.payload || null;
        });
        builder.addCase(loadRuntimeInfo.rejected, (state, action) => {
            state.runtimeLoading = false;
            state.runtimeInfo = (action.payload as ContainerRuntimeHealth) || {
                name: '',
                registered: false,
                healthy: false,
                checkable: false,
                error: 'runtime check failed',
            };
        });
    }
})


export const { setUserItem, clearUserSession } = contextSlice.actions
export default contextSlice.reducer


