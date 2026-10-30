import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { getActiveProjectApi } from '@/api/project'
import { getCurrentUserApi, type AgentProfileInfo, type AgentUserConfig, type UserMenuTab } from '@/api/auth'
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
const rightPanelWidth = Number(localStorage.getItem('rightPanelWidth'))
// 左侧面板是否折叠隐藏
const leftPanelCollapsed = localStorage.getItem('leftPanelCollapsed') === 'true'
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

export interface LoginUserInfo {
    id: string;
    username: string;
    email: string;
    avatar: string;
    profile?: string;
    agent_config?: AgentUserConfig;
    /** 主区域标签页配置（url + 显示名），刷新后由 MainTabs 回填。 */
    menu_config?: { tabs?: UserMenuTab[] };
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
    rightPanelWidth:number;
    /** 左侧面板是否折叠隐藏 */
    leftPanelCollapsed:boolean;
    leftActivityKey:string;
    sideView:string;
    /** 左侧栏堆叠视图折叠状态：{ [stackKey]: collapsedSectionKeys[] }。 */
    leftStackCollapsed: Record<string, string[]>;
    userInfo: LoginUserInfo | null;
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
        rightPanelWidth:Number.isFinite(rightPanelWidth)?rightPanelWidth:360,
        leftPanelCollapsed,
        leftActivityKey:leftActivityKey?leftActivityKey:'sysFileBrowser',
        sideView:sideView?sideView:'agentChat',
        leftStackCollapsed,
        userInfo: null as LoginUserInfo | null,
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
            if (action.payload.rightPanelWidth !== undefined) {
                localStorage.setItem('rightPanelWidth', String(action.payload.rightPanelWidth))
            }
            if (action.payload.leftPanelCollapsed !== undefined) {
                localStorage.setItem('leftPanelCollapsed', String(action.payload.leftPanelCollapsed))
            }
            if (action.payload.leftActivityKey !== undefined) {
                localStorage.setItem('leftActivityKey', action.payload.leftActivityKey)
            }
            if (action.payload.leftStackCollapsed !== undefined) {
                localStorage.setItem('leftStackCollapsed', JSON.stringify(action.payload.leftStackCollapsed))
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
        /**
         * 乐观更新当前用户的主区域标签页配置（MainTabs 在本地变更时立即调用）。
         * 真正的落库由 MainTabs 异步调用 /auth/menu-config 完成，这里只保证 redux 内的数据是最新的，
         * 避免用户信息重新拉取前读到旧值。
         */
        setUserMenuTabs(state, action: PayloadAction<UserMenuTab[]>) {
            if (!state.userInfo) {
                return;
            }
            state.userInfo.menu_config = { tabs: action.payload };
        },
        clearUserSession(state) {
            state.authorization = null;
            state.refreshToken = null;
            state.userInfo = null;
            state.projectId = "";
            state.project = {};
            state.activeLLMSessionId = null;
            localStorage.removeItem('Authorization');
            localStorage.removeItem('authorization');
            localStorage.removeItem('RefreshToken');
            localStorage.removeItem('activeProjectReportId');
            localStorage.removeItem('activeLLMSessionId');
        },
    },
    extraReducers: (builder) => {
        builder.addCase(loadActiveProject.fulfilled, (state, action) => {
            state.projectId = action.payload?.project_id || "";
            state.project = action.payload || {};
        });
        builder.addCase(loadCurrentUser.fulfilled, (state, action) => {
            state.userInfo = action.payload || null;
        });
    }
})


export const { setUserItem, setUserMenuTabs, clearUserSession } = contextSlice.actions
export default contextSlice.reducer


