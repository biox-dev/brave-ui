import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { getActiveProjectApi } from '@/api/project'
import { getCurrentUserApi, type AgentUserConfig } from '@/api/auth'
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
const leftActivityKey = localStorage.getItem('leftActivityKey')
const sideView = localStorage.getItem('sideView')

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
    leftActivityKey:string;
    sideView:string;
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
        leftActivityKey:leftActivityKey?leftActivityKey:'sysFileBrowser',
        sideView:sideView?sideView:'agentChat',
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
            if (action.payload.leftActivityKey !== undefined) {
                localStorage.setItem('leftActivityKey', action.payload.leftActivityKey)
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


export const { setUserItem, clearUserSession } = contextSlice.actions
export default contextSlice.reducer


