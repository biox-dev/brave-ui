import type { BubbleListProps, ConversationItemType, ThoughtChainItemType, ThoughtChainProps } from '@ant-design/x';
import { Bubble, Conversations, Sender, ThoughtChain } from '@ant-design/x';
import { AbstractChatProvider, DefaultMessageInfo, useXChat, XRequest, XRequestOptions } from '@ant-design/x-sdk';
import { Button, Flex, GetProp, Popconfirm, Popover, Space, Tag, Typography, theme } from 'antd';
import React, { FC, forwardRef, useEffect, useImperativeHandle } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import XMarkdown from '@ant-design/x-markdown';
import { CheckCircleOutlined, ClearOutlined, CommentOutlined, DeleteOutlined, InfoCircleOutlined, LoadingOutlined, PlusOutlined, RedoOutlined } from '@ant-design/icons';
import { useGlobalMessage } from '@/hooks/useGlobalMessage';
import { sseClient } from '@/sse';
import { http } from '@/api/client/http';
import { getActiveProjectApi } from '@/api/project';
import { setUserItem } from '@/store/userSlice';
import { invoke } from '@/core/ui-system/invokeV2';
import { useStoreRender } from '@/context/render/RenderProvider';
const { Text } = Typography;

type LLMSessionRecord = {
    id: number;
    project_id: string;
    title?: string;
    status?: string;
};

type LLMConversationRecord = {
    id: number;
    conversation_id: string;
    llm_session_id: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model?: string;
};

// 类型定义：自定义聊天系统的输入输出和消息结构
// Type definitions: custom chat system input/output and message structure
interface CustomInput {
    message: string;
    role: 'user';
    stream?: boolean;
    session_id?: number;
    biz_type: string;
    biz_id: string;
    project_id: string;
    is_save_prompt?: boolean;
    env?: any

}

interface CustomOutput {
    data: string;
}

interface CustomMessage {
    content: string;
    think?: any[];
    role: 'user' | 'assistant' | 'system';
}
interface CustomProviderOptions {
    setThoughtChainItems?: any
}

type WSIncomingEvent = {
    event: string;
    data: unknown;
};

type PermissionRequestItem = {
    requestId: string;
    sessionId: string;
    kind: string;
    requiresWriteConfirm: boolean;
    fileName: string;
    intention: string;
    toolCallId: string;
    diff: string;
    newFileContents: string;
    request: Record<string, unknown>;
};

function normalizeChunkPayload(payload: unknown): Record<string, unknown> | undefined {
    if (!payload) {
        return undefined;
    }

    if (typeof payload === 'string') {
        try {
            const parsed = JSON.parse(payload);
            return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : undefined;
        } catch {
            return undefined;
        }
    }

    return typeof payload === 'object' ? payload as Record<string, unknown> : undefined;
}

function formatErrorEventMessage(payload: unknown): string {
    if (typeof payload === 'string') {
        return payload.trim();
    }

    const data = normalizeChunkPayload(payload);
    if (!data) {
        return '';
    }

    const detail = typeof data.detail === 'string' ? data.detail.trim() : '';
    const error = typeof data.error === 'string' ? data.error.trim() : '';
    const event = typeof data.event === 'string' ? data.event.trim() : '';

    const parts = [detail, error, event && `event: ${event}`].filter(Boolean);
    if (parts.length > 0) {
        return parts.join('\n');
    }

    try {
        return JSON.stringify(data, null, 2);
    } catch {
        return '';
    }
}

function toSSEChunk(event: string, payload: unknown) {
    const safeEvent = (event || 'message').replace(/\n/g, '');
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    return `event:${safeEvent}\ndata:${data}\n\n`;
}

function createWSFetchAdapter(handlers?: {
    onSessionCreated?: (sessionID: string) => void;
    onEvent?: (event: WSIncomingEvent, sessionID: string) => void;
}) {
    const encoder = new TextEncoder();
    let activeSessionId = '';
    let unsubscribe: (() => void) | undefined;

    const cleanup = () => {
        if (unsubscribe) {
            unsubscribe();
            unsubscribe = undefined;
        }
    };

    return async (
        _url: Parameters<typeof fetch>[0],
        options: XRequestOptions<any, any>,
    ): Promise<Response> => {
        cleanup();

        const params = (options?.params || {}) as Record<string, unknown>;
        const requestedSessionId =
            typeof params.session_id === 'number'
                ? String(params.session_id)
                : typeof params.session_id === 'string' && params.session_id
                    ? params.session_id
                    : '';
        const sessionId = requestedSessionId;
        if (!sessionId) {
            throw new Error('session_id is required');
        }
        activeSessionId = sessionId;
        handlers?.onSessionCreated?.(sessionId);

        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                let closed = false;

                const closeStream = () => {
                    if (closed) {
                        return;
                    }
                    closed = true;
                    cleanup();
                    controller.close();
                };

                const onAbort = () => {
                    sseClient.send({
                        type: 'llm.chat.stop',
                        session_id: sessionId,
                        require_ack: false,
                    });
                    closeStream();
                };

                if (options?.signal) {
                    if (options.signal.aborted) {
                        onAbort();
                        return;
                    }
                    options.signal.addEventListener('abort', onAbort, { once: true });
                }

                unsubscribe = sseClient.onMessage((raw: unknown) => {
                    if (!raw || typeof raw !== 'object') {
                        return;
                    }

                    const msg = raw as Record<string, unknown>;
                    if (msg.type !== 'llm.event') {
                        return;
                    }

                    const incomingSessionId =
                        typeof msg.session_id === 'string' ? msg.session_id : '';
                    if (!incomingSessionId || incomingSessionId !== activeSessionId) {
                        return;
                    }

                    const evtName = typeof msg.event === 'string' ? msg.event : 'message';
                    const evt: WSIncomingEvent = {
                        event: evtName,
                        data: msg.data,
                    };

                    handlers?.onEvent?.(evt, incomingSessionId);

                    controller.enqueue(encoder.encode(toSSEChunk(evt.event, evt.data)));

                    if (evt.event === 'completed' || evt.event === 'error') {
                        controller.enqueue(encoder.encode('data:[DONE]\n\n'));
                        closeStream();
                    }
                });

                const sent = sseClient.send({
                    type: 'llm.chat.start',
                    session_id: sessionId,
                    prompt: typeof params.message === 'string' ? params.message : '',
                    biz_id: params.biz_id,
                    biz_type: params.biz_type,
                    project_id: params.project_id,
                    is_save_prompt: params.is_save_prompt,
                    require_ack: false,
                    env: params.env,
                });

                if (!sent) {
                    controller.error(new Error('Realtime socket is not connected.'));
                    cleanup();
                }
            },
        });

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
            },
        });
    };
}


function getStatusIcon(status: ThoughtChainItemType['status']) {
    switch (status) {
        case 'success':
            return <CheckCircleOutlined />;
        case 'error':
            return <InfoCircleOutlined />;
        case 'loading':
            return <LoadingOutlined />;
        default:
            return undefined;
    }
}

function finalizeLoadingThinkItems(items: any[], status: ThoughtChainItemType['status'] = 'success') {
    if (!Array.isArray(items) || items.length === 0) {
        return [];
    }
    return items.map((item) => {
        if (item?.status === 'loading') {
            return {
                ...item,
                status,
                icon: getStatusIcon(status),
            };
        }
        return item;
    });
}

type PersistedLLMEvent = {
    kind?: string;
    event?: string;
    data?: any;
};

function parsePersistedLLMEvent(content: string): PersistedLLMEvent | null {
    const raw = String(content || '').trim();
    if (!raw.startsWith('{')) {
        return null;
    }
    try {
        const parsed: any = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') {
            return null;
        }
        if (String(parsed.kind || '') !== 'llm_event') {
            return null;
        }
        return parsed as PersistedLLMEvent;
    } catch {
        return null;
    }
}

function buildThoughtFromPersistedEvent(event: string, data: any): any | null {
    const safeData = (data && typeof data === 'object') ? data : {};

    if (event === 'assistant.reasoning_delta') {
        const delta = String(safeData?.deltaContent || '').trim();
        if (!delta) {
            return null;
        }
        const reasoningId = String(safeData?.reasoningId || '').trim();
        return {
            title: 'think',
            description: delta,
            status: 'success',
            icon: getStatusIcon('success'),
            _reasoningId: reasoningId,
        };
    }

    if (event === 'permission.request') {
        const request = (safeData?.request && typeof safeData.request === 'object') ? safeData.request : {};
        const kind = String(safeData?.kind || request?.kind || 'unknown');
        const commandText = Array.isArray(request?.commands)
            ? request.commands
                .map((cmd: any) => String(cmd?.identifier || '').trim())
                .filter(Boolean)
                .join('\n')
            : '';
        const detail = [
            String(request?.intention || '').trim(),
            String(request?.fullCommandText || '').trim(),
            commandText,
            String(request?.path || '').trim(),
        ].find((text) => !!text) || 'permission request';
        return {
            title: `permission.${kind}`,
            description: detail,
            status: 'success',
            icon: getStatusIcon('success'),
        };
    }

    if (event === 'permission.decision') {
        const kind = String(safeData?.kind || 'unknown');
        const approved = Boolean(safeData?.approved);
        const reason = String(safeData?.reason || '').trim();
        return {
            title: `permission.${kind}.decision`,
            description: approved ? 'approved' : (reason || 'rejected'),
            status: approved ? 'success' : 'error',
            icon: getStatusIcon(approved ? 'success' : 'error'),
        };
    }

    if (event === 'command.queued') {
        const command = String(safeData?.command || '').trim();
        if (!command) {
            return null;
        }
        return {
            title: 'run',
            description: command,
            status: 'success',
            icon: getStatusIcon('success'),
        };
    }

    if (event === 'session.plan_changed') {
        const op = String(safeData?.operation || 'update');
        const status = op === 'delete' ? 'error' : 'success';
        return {
            title: 'planning',
            description: `plan ${op}`,
            status,
            icon: getStatusIcon(status as ThoughtChainItemType['status']),
        };
    }

    return null;
}


// 自定义Provider实现：继承AbstractChatProvider实现自定义聊天逻辑
// Custom Provider implementation: extend AbstractChatProvider to implement custom chat logic
class CustomProvider<
    ChatMessage extends CustomMessage = CustomMessage,
    Input extends CustomInput = CustomInput,
    Output extends CustomOutput = CustomOutput,
> extends AbstractChatProvider<ChatMessage, Input, Output> {

    private setThoughtChainItems?: any;
    constructor(
        options: any,
        customOptions?: CustomProviderOptions,
    ) {
        super(options);
        this.setThoughtChainItems = customOptions?.setThoughtChainItems;
    }

    // 转换请求参数：将用户输入转换为标准格式
    // Transform request parameters: convert user input to standard format
    transformParams(requestParams: Partial<Input>): Input {
        if (typeof requestParams !== 'object') {
            throw new Error('requestParams must be an object');
        }
        return requestParams as Input;
    }

    // 转换本地消息：将请求参数转换为本地消息格式
    // Transform local message: convert request parameters to local message format
    transformLocalMessage(requestParams: Partial<Input>): ChatMessage {
        return {
            content: requestParams.message || '',
            role: 'user',
        } as ChatMessage;
    }

    // 转换消息：处理流式响应数据
    // Transform message: process streaming response data
    transformMessage(info: any): ChatMessage {
        const { originMessage, chunk } = info || {};
        // console.log('stream info:', originMessage, chunk);
        if (chunk?.event === "permission.request") {
            const chunkJson: any = typeof chunk?.data === 'string' ? JSON.parse(chunk.data) : (chunk?.data || {});
            const request = (chunkJson?.request && typeof chunkJson.request === 'object') ? chunkJson.request : {};
            const kind = String(chunkJson?.kind || request?.kind || 'unknown');
            const requiresWriteConfirm = Boolean(chunkJson?.requires_write_confirm);

            const commandText = Array.isArray(request?.commands)
                ? request.commands
                    .map((cmd: any) => String(cmd?.identifier || '').trim())
                    .filter(Boolean)
                    .join('\n')
                : '';

            const detail = [
                String(request?.intention || '').trim(),
                String(request?.fullCommandText || '').trim(),
                commandText,
                String(request?.path || '').trim(),
            ].find((text) => !!text) || 'permission request';

            const settledThink = finalizeLoadingThinkItems(originMessage?.think || [], 'success');
            return {
                think: [
                    ...settledThink,
                    {
                        title: `permission.${kind}`,
                        description: detail,
                        status: requiresWriteConfirm ? 'loading' : 'success',
                        icon: getStatusIcon(requiresWriteConfirm ? 'loading' : 'success'),
                    },
                ],
                content: originMessage?.content || '',
                role: 'assistant',
            } as ChatMessage;
        }

        if (chunk?.event === "completed") {
            return {
                think: finalizeLoadingThinkItems(originMessage?.think || [], 'success'),
                content: originMessage?.content || '',
                role: 'assistant',
            } as ChatMessage;
        }

        if (chunk?.event === "error") {
            const errorMessage = formatErrorEventMessage(chunk?.data);
            const previousContent = String(originMessage?.content || '');
            return {
                think: finalizeLoadingThinkItems(originMessage?.think || [], 'error'),
                content: errorMessage
                    ? previousContent
                        ? `${previousContent}\n\n${errorMessage}`
                        : errorMessage
                    : previousContent,
                role: 'assistant',
            } as ChatMessage;
        }

        if (chunk?.event === "assistant.reasoning_delta") {
            try {
                const chunkJson: any = typeof chunk?.data === 'string' ? JSON.parse(chunk.data) : (chunk?.data || {});
                const delta = String(chunkJson?.deltaContent || '');
                const reasoningId = String(chunkJson?.reasoningId || '').trim();
                if (!delta.trim()) {
                    return {
                        think: originMessage?.think || [],
                        content: originMessage?.content || '',
                        role: 'assistant',
                    } as ChatMessage;
                }

                const currentThink = Array.isArray(originMessage?.think) ? [...originMessage.think] : [];
                if (reasoningId) {
                    for (let i = 0; i < currentThink.length; i++) {
                        const item = currentThink[i];
                        if (item?.status === 'loading' && item?._reasoningId && item._reasoningId !== reasoningId) {
                            currentThink[i] = {
                                ...item,
                                status: 'success',
                                icon: getStatusIcon('success'),
                            };
                        }
                    }

                    const existingIndex = currentThink.findIndex((item: any) => item?._reasoningId === reasoningId);
                    if (existingIndex >= 0) {
                        const existing = currentThink[existingIndex] || {};
                        currentThink[existingIndex] = {
                            ...existing,
                            title: existing?.title || 'think',
                            description: `${String(existing?.description || '')}${delta}`,
                            status: 'loading',
                            icon: getStatusIcon('loading'),
                            _reasoningId: reasoningId,
                        };
                    } else {
                        currentThink.push({
                            title: 'think',
                            description: delta,
                            status: 'loading',
                            icon: getStatusIcon('loading'),
                            _reasoningId: reasoningId,
                        });
                    }
                } else {
                    currentThink.push({
                        title: 'think',
                        description: delta,
                        status: 'loading',
                        icon: getStatusIcon('loading'),
                    });
                }

                return {
                    think: currentThink,
                    content: originMessage?.content || '',
                    role: 'assistant',
                } as ChatMessage;
            } catch {
                return {
                    think: originMessage?.think || [],
                    content: originMessage?.content || '',
                    role: 'assistant',
                } as ChatMessage;
            }
        }

        if (chunk?.event === "command.queued") {
            try {
                const chunkJson: any = typeof chunk?.data === 'string' ? JSON.parse(chunk.data) : (chunk?.data || {});
                const commandText = String(chunkJson?.command || '').trim();
                if (!commandText) {
                    return {
                        think: originMessage?.think || [],
                        content: originMessage?.content || '',
                        role: 'assistant',
                    } as ChatMessage;
                }

                const settledThink = finalizeLoadingThinkItems(originMessage?.think || [], 'success');
                return {
                    think: [
                        ...settledThink,
                        {
                            title: 'run',
                            description: commandText,
                            status: 'success',
                            icon: getStatusIcon('success'),
                        },
                    ],
                    content: originMessage?.content || '',
                    role: 'assistant',
                } as ChatMessage;
            } catch {
                return {
                    think: originMessage?.think || [],
                    content: originMessage?.content || '',
                    role: 'assistant',
                } as ChatMessage;
            }
        }

        if (chunk?.event === "session.plan_changed") {
            try {
                const chunkJson: any = typeof chunk?.data === 'string' ? JSON.parse(chunk.data) : (chunk?.data || {});
                const op = String(chunkJson?.operation || 'update');
                const settledThink = finalizeLoadingThinkItems(originMessage?.think || [], 'success');
                return {
                    think: [
                        ...settledThink,
                        {
                            title: 'planning',
                            description: `plan ${op}`,
                            status: op === 'delete' ? 'error' : 'success',
                            icon: getStatusIcon(op === 'delete' ? 'error' : 'success'),
                        },
                    ],
                    content: originMessage?.content || '',
                    role: 'assistant',
                } as ChatMessage;
            } catch {
                return {
                    think: originMessage?.think || [],
                    content: originMessage?.content || '',
                    role: 'assistant',
                } as ChatMessage;
            }
        }

        if (chunk?.event == "status") {
            const chunkJson: any = JSON.parse(chunk.data);
            // this.setThoughtChainItems((prev: any) => [
            //     ...prev,
            //     {
            //         title: chunkJson?.title,
            //         description: chunkJson?.content,
            //         status: 'success',
            //         icon: getStatusIcon('success'),
            //     },
            // ]);
            // console.log('updated thought chain items:', chunkJson?.content);

            // this.setThoughtChainItems(chunkJson?.content);
            const data = {
                think: [...(originMessage?.think || []), chunkJson],
                content: originMessage?.content || '',
                role: 'assistant',
            } as ChatMessage;
            console.log('status chunk data:', data);
            return data
        } else {
            // debugger
            // 处理完成标记或空数据
            // Handle completion marker or empty data
            if (!chunk || !chunk?.data || (chunk?.data && chunk?.data?.includes('[DONE]'))) {
                return {
                    think: finalizeLoadingThinkItems(originMessage?.think || [], 'success'),
                    content: `${originMessage?.content}`,
                    role: 'assistant',
                } as ChatMessage;
            }

            try {
                // 处理流式数据：解析JSON格式
                // Process streaming data: parse JSON format
                const chunkJson = JSON.parse(chunk.data);
                console.log('parsed chunk data:', chunkJson);
                const content = originMessage?.content || '';
                const deltaContent = typeof chunkJson.deltaContent === 'string' ? chunkJson.deltaContent : '';
                return {
                    think: deltaContent
                        ? finalizeLoadingThinkItems(originMessage?.think || [], 'success')
                        : (originMessage?.think || []),
                    content: `${content}${deltaContent}`,
                    role: 'assistant',
                } as ChatMessage;
            } catch (error) {
                // 如果解析失败，直接使用原始数据
                // If parsing fails, use raw data directly
                return {
                    think: originMessage?.think || [],
                    content: `${originMessage?.content || ''}${chunk.data || ''}`,
                    role: 'assistant',
                } as ChatMessage;
            }
        }


    }
}

// 消息角色配置：定义不同角色消息的布局和样式
// Message role configuration: define layout and styles for different role messages
const roles = (
    setMessage: any,
    loadHistoryMessage: any,
    thoughtChainItems?: ThoughtChainProps['items'],
    expandedKeys: string[] = [],
    onExpandedKeys?: any,
): GetProp<typeof Bubble.List, 'role'> => (
    {

        assistant: {
            footerPlacement: 'inner-start',
            placement: 'start',
            header: (content, { status }) => {
                // console.log('assistant header content:', content);
                // const config = ThoughtChainConfig[status as keyof typeof ThoughtChainConfig];
                return <>
                    <ThoughtChain items={content.think} expandedKeys={expandedKeys} onExpand={onExpandedKeys} />

                </>
            },
            contentRender(content: CustomMessage) {
                // return (content as any)?.content;
                const newContent = content.content //.replace(/\n\n/g, '<br/><br/>');
                return (<>

                    <XMarkdown content={newContent} />
                </>)
            }, footer: (
                (content, { status, key }) => (
                    <div style={{ display: 'flex' }}>
                        {/* <Footer content={content} status={status} id={key} /> */}

                        {/* {content?.chat_history_id && <>
                            <Popconfirm title="Are you sure to delete this message?" onConfirm={async () => {
                                const resp = await axios.delete(`/llm/chat/history/del-by-chat-history-id/${content?.chat_history_id}`);
                                loadHistoryMessage();

                            }}>
                                <Button style={{ color: "red" }} type="text" size="small" icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </>} */}

                        {/* {JSON.stringify(content)} */}
                        {/* <Button type="text" size="small" icon={<ReloadOutlined />} />
                <Button type="text" size="small" icon={<CopyOutlined />} />
                <Button type="text" size="small" icon={<LikeOutlined />} />
                <Button type="text" size="small" icon={<DislikeOutlined />} /> */}
                    </div>
                )
            ),
        },
        user: {
            placement: 'end',
            footerPlacement: 'inner-start',
            contentRender(content: CustomMessage) {
                return (content as any)?.content;
            }, footer: (
                (content) => (
                    <div style={{ display: 'flex' }}>
                        {content?.chat_history_id && <>
                            <Popconfirm title="Are you sure to delete this message?" onConfirm={async () => {
                                await http.post('/llm/conversation/delete', { id: content?.chat_history_id });
                                loadHistoryMessage()
                            }}>
                                <Button style={{ color: "red" }} type="text" size="small" icon={<DeleteOutlined />} />
                            </Popconfirm>
                        </>}

                        {/* {JSON.stringify(content)} */}
                        {/* <Button type="text" size="small" icon={<ReloadOutlined />} />
                <Button type="text" size="small" icon={<CopyOutlined />} />
                <Button type="text" size="small" icon={<LikeOutlined />} />
                <Button type="text" size="small" icon={<DislikeOutlined />} /> */}
                    </div>
                )
            ),
        },
        system: {
            variant: 'borderless', // 无边框样式
            contentRender(content: CustomMessage) {
                return content?.content;
            },
        },
    }
)
// const role: BubbleListProps['role'] = 

// 本地化钩子：根据当前语言环境返回对应的文本
// Localization hook: return corresponding text based on current language environment
const useLocale = () => {
    const isCN = typeof location !== 'undefined' ? location.pathname.endsWith('-cn') : false;
    return {
        abort: isCN ? '中止' : 'abort',
        addUserMessage: isCN ? '添加用户消息' : 'Add a user message',
        addAIMessage: isCN ? '添加AI消息' : 'Add an AI message',
        addSystemMessage: isCN ? '添加系统消息' : 'Add a system message',
        editLastMessage: isCN ? '编辑最后一条消息' : 'Edit the last message',
        placeholder: isCN
            ? '请输入内容，按下 Enter 发送消息'
            : 'Please enter content and press Enter to send message',
        waiting: isCN ? '等待中...' : 'Waiting...',
        mockFailed: isCN ? '模拟失败返回，请稍后再试。' : 'Mock failed return. Please try again later.',
        historyUserMessage: isCN ? '这是一条历史消息' : 'This is a historical message',
        historyAIResponse: isCN
            ? '这是一条历史回答消息，请发送新消息。'
            : 'This is a historical response message, please send a new message.',
        editSystemMessage: isCN ? '编辑系统消息' : 'Edit a system message',
        editUserMessage: isCN ? '编辑用户消息' : 'Edit a user message',
        editAIResponse: isCN ? '编辑AI回复' : 'Edit an AI response',
        customProviderTitle: isCN ? '自定义Provider示例' : 'Custom Provider Example',
        customProviderDesc: isCN
            ? '这是一个使用自定义Provider的示例，展示了如何继承AbstractChatProvider来实现自定义的数据处理逻辑。'
            : 'This is an example using a custom provider, demonstrating how to extend AbstractChatProvider to implement custom data processing logic.',
    };
};

const App = forwardRef<any, any>(({ biz_id, biz_type }, ref) => {
    const { project, userInfo, activeLLMSessionId } = useSelector((state: any) => state.user)
    const dispatch = useDispatch()
    const { token } = theme.useToken();

    const [content, setContent] = React.useState('');
    const locale = useLocale();
    const messageApi = useGlobalMessage()
    const [expandedKeys, setExpandedKeys] = React.useState<string[]>([]);
    const [thoughtChainItems, setThoughtChainItems] = React.useState<any>([]);
    const openingPermissionRequestIdsRef = React.useRef<Set<string>>(new Set());
    const activeSessionIdRef = React.useRef('');
    const [conversationItems, setConversationItems] = React.useState<ConversationItemType[]>([]);
    const [sessionMap, setSessionMap] = React.useState<Record<string, LLMSessionRecord>>({});
    const [activeConversationKey, setActiveConversationKey] = React.useState<string>('');
    const [currentProjectId, setCurrentProjectId] = React.useState<string>(project || '');
    const sessionMapRef = React.useRef<Record<string, LLMSessionRecord>>({});
    const activeConversationKeyRef = React.useRef<string>('');
    const skipNextAutoLoadSessionKeyRef = React.useRef<string>('');
    const { script, analysisNodeId } = useStoreRender()

    useEffect(() => {
        sessionMapRef.current = sessionMap;
    }, [sessionMap]);

    useEffect(() => {
        activeConversationKeyRef.current = activeConversationKey;
    }, [activeConversationKey]);

    const submitPermissionDecision = React.useCallback((item: PermissionRequestItem, approved: boolean) => {
        const ok = sseClient.send({
            type: 'llm.permission.decision',
            session_id: item.sessionId || activeSessionIdRef.current,
            request_id: item.requestId,
            approved,
            reason: approved ? '' : 'rejected by user',
            require_ack: false,
        });

        if (!ok) {
            messageApi.error('Realtime WS 未连接，无法提交权限确认');
        }
    }, [messageApi]);

    const promptPermissionDecision = React.useCallback(async (item: PermissionRequestItem) => {
        if (!item.requestId) {
            return;
        }

        const openingIds = openingPermissionRequestIdsRef.current;
        if (openingIds.has(item.requestId)) {
            return;
        }
        openingIds.add(item.requestId);

        try {
            const result = await invoke.writePermission.openAsync(
                {
                    requestId: item.requestId,
                    sessionId: item.sessionId,
                    kind: item.kind,
                    requiresWriteConfirm: item.requiresWriteConfirm,
                    fileName: item.fileName,
                    intention: item.intention,
                    toolCallId: item.toolCallId,
                    diff: item.diff,
                    newFileContents: item.newFileContents,
                    request: item.request,
                },
                {
                    title: `Write Permission: ${item.kind}`,
                    width: '70vw',
                    footer: false,
                    closable: false,
                    maskClosable: false,
                },
            );

            const approved =
                typeof result === 'boolean'
                    ? result
                    : Boolean((result as { approved?: unknown } | undefined)?.approved);

            submitPermissionDecision(item, approved);
        } catch {
            submitPermissionDecision(item, false);
        } finally {
            openingIds.delete(item.requestId);
        }
    }, [submitPermissionDecision]);

    const handleBridgeEvent = React.useCallback((evt: WSIncomingEvent, incomingSessionId: string) => {
        if (evt.event === 'permission.request' && evt.data && typeof evt.data === 'object') {
            const request = evt.data as Record<string, unknown>;
            const requiresWriteConfirm = Boolean(request.requires_write_confirm);
            const requestId = typeof request.request_id === 'string' ? request.request_id : '';
            const kind = typeof request.kind === 'string' ? request.kind : 'unknown';
            const requestPayload =
                request.request && typeof request.request === 'object'
                    ? (request.request as Record<string, unknown>)
                    : {};
            const fileName = typeof requestPayload.fileName === 'string' ? requestPayload.fileName : '';
            const intention = typeof requestPayload.intention === 'string' ? requestPayload.intention : '';
            const toolCallId = typeof requestPayload.toolCallId === 'string' ? requestPayload.toolCallId : '';
            const diff = typeof requestPayload.diff === 'string' ? requestPayload.diff : '';
            const newFileContents = typeof requestPayload.newFileContents === 'string' ? requestPayload.newFileContents : '';
            const sessionId =
                typeof request.session_id === 'string'
                    ? request.session_id
                    : typeof request.copilot_session_id === 'string'
                        ? request.copilot_session_id
                        : incomingSessionId;

            if (!requiresWriteConfirm || !requestId) {
                return;
            }

            promptPermissionDecision({
                requestId,
                sessionId,
                kind,
                requiresWriteConfirm,
                fileName,
                intention,
                toolCallId,
                diff,
                newFileContents,
                request: requestPayload,
            }).catch(() => {
                // no-op: fallback handled in promptPermissionDecision
            });
            return;
        }

        if (evt.event === 'permission.decision' && evt.data && typeof evt.data === 'object') {
            const request = evt.data as Record<string, unknown>;
            const requestId = typeof request.request_id === 'string' ? request.request_id : '';
            if (!requestId) {
                return;
            }
            openingPermissionRequestIdsRef.current.delete(requestId);
            return;
        }

    }, [promptPermissionDecision]);

    // 使用自定义Provider：创建自定义聊天提供者实例
    // Use custom provider: create custom chat provider instance
    const [provider] = React.useState(
        new CustomProvider<CustomMessage, CustomInput, CustomOutput>({
            request: XRequest('realtime://llm.chat.stream', {
                manual: true,
                fetch: createWSFetchAdapter({
                    onSessionCreated: (sessionID) => {
                        activeSessionIdRef.current = sessionID;
                    },
                    onEvent: handleBridgeEvent,
                }),
            })
        }, { setThoughtChainItems }),
    );

    // 聊天消息管理：使用聊天钩子管理消息和请求
    // Chat message management: use chat hook to manage messages and requests
    const { onRequest, messages, abort, isRequesting, setMessages, setMessage } = useXChat({
        provider,
        requestPlaceholder: { content: locale.waiting, role: 'assistant' },
    });

    const resolveProjectId = React.useCallback(async () => {
        const projectIdFromStore = (project || '').trim();
        if (projectIdFromStore) {
            setCurrentProjectId(projectIdFromStore);
            return projectIdFromStore;
        }

        try {
            const resp = await getActiveProjectApi();
            const projectId = (resp?.data?.project_id || '').trim();
            setCurrentProjectId(projectId);
            return projectId;
        } catch {
            return '';
        }
    }, [project]);

    const loadConversationMessages = React.useCallback(async (llmSessionID: number) => {
        if (!llmSessionID) {
            dispatch(setUserItem({ activeLLMSessionId: null }))
            setMessages([]);
            return;
        }

        dispatch(setUserItem({ activeLLMSessionId: String(llmSessionID) }))

        const resp = await http.get<LLMConversationRecord[]>(`/llm/conversation/list?session_id=${llmSessionID}`);
        const rows = Array.isArray(resp.data) ? resp.data : [];
        const serverMessages: any[] = [];
        rows.forEach((row) => {
            if (row.role === 'system') {
                const persisted = parsePersistedLLMEvent(row.content);
                const eventName = String(persisted?.event || '').trim();
                const thoughtItem = persisted ? buildThoughtFromPersistedEvent(eventName, persisted.data) : null;
                if (thoughtItem) {
                    const lastIndex = serverMessages.length - 1;
                    const last = lastIndex >= 0 ? serverMessages[lastIndex] : null;
                    if (last?.message?.role === 'assistant') {
                        const currentThink = Array.isArray(last.message.think) ? [...last.message.think] : [];
                        const reasoningId = String(thoughtItem?._reasoningId || '').trim();
                        if (reasoningId) {
                            const existingIndex = currentThink.findIndex((item: any) => item?._reasoningId === reasoningId);
                            if (existingIndex >= 0) {
                                const existing = currentThink[existingIndex] || {};
                                currentThink[existingIndex] = {
                                    ...existing,
                                    description: `${String(existing?.description || '')}${String(thoughtItem?.description || '')}`,
                                    status: thoughtItem?.status || existing?.status,
                                    icon: thoughtItem?.icon || existing?.icon,
                                };
                            } else {
                                currentThink.push(thoughtItem);
                            }
                        } else {
                            currentThink.push(thoughtItem);
                        }
                        serverMessages[lastIndex] = {
                            ...last,
                            message: {
                                ...last.message,
                                think: currentThink,
                            },
                        };
                    } else {
                        serverMessages.push({
                            id: `${row.id}-event`,
                            message: {
                                think: [thoughtItem],
                                content: '',
                                role: 'assistant',
                            },
                            status: 'local',
                        });
                    }
                    return;
                }
            }

            serverMessages.push({
                id: String(row.id),
                message: {
                    think: [],
                    content: row.content,
                    role: row.role,
                    chat_history_id: row.id,
                },
                status: 'local',
            });
        });

        setMessages((prev: any[]) => {
            if (!Array.isArray(prev) || prev.length === 0) {
                return serverMessages;
            }

            // Keep optimistic local user messages that have not been linked to DB rows yet.
            const pendingLocalUserMessages = prev.filter((item) => (
                item?.message?.role === 'user' &&
                !item?.message?.chat_history_id
            ));

            if (pendingLocalUserMessages.length === 0) {
                return serverMessages;
            }

            const serverUserContents = new Set(
                serverMessages
                    .filter((item) => item?.message?.role === 'user')
                    .map((item) => String(item?.message?.content || ''))
            );

            const mergedPending = pendingLocalUserMessages.filter((item) => (
                !serverUserContents.has(String(item?.message?.content || ''))
            ));

            if (mergedPending.length === 0) {
                return serverMessages;
            }

            return [...serverMessages, ...mergedPending];
        });
    }, [dispatch, setMessages]);

    const toConversationItem = React.useCallback((item: LLMSessionRecord): ConversationItemType => {
        const title = (item.title || '').trim();
        return {
            key: String(item.id),
            label: title || String(item.id),
            group: 'Current Project',
        };
    }, []);

    const loadSessionList = React.useCallback(async () => {
        const resp = await http.get<LLMSessionRecord[]>('/llm/session/list');
        const rows = Array.isArray(resp.data) ? resp.data : [];

        const nextMap: Record<string, LLMSessionRecord> = {};
        rows.forEach((row) => {
            nextMap[String(row.id)] = row;
        });
        setSessionMap(nextMap);
        setConversationItems(rows.map(toConversationItem));

        // If the currently active session no longer exists, clear it
        const currentKey = activeConversationKeyRef.current;
        if (currentKey && !nextMap[currentKey]) {
            setActiveConversationKey('');
            activeSessionIdRef.current = '';
            dispatch(setUserItem({ activeLLMSessionId: null }))
            setMessages([]);
            return;
        }

        // Restore the previously active session on init if it still exists.
        if (!currentKey) {
            const storedKey = String(activeLLMSessionId || '').trim();
            if (storedKey && nextMap[storedKey]) {
                setActiveConversationKey(storedKey);
                activeSessionIdRef.current = storedKey;
                return;
            }

            if (storedKey && !nextMap[storedKey]) {
                dispatch(setUserItem({ activeLLMSessionId: null }))
            }
        }
    }, [activeLLMSessionId, dispatch, toConversationItem, setMessages]);

    const createSession = React.useCallback(async () => {
        // const projectId = await resolveProjectId();
        // if (!projectId) {
        //     messageApi.error('No active project found.');
        //     return null;
        // }

        const payload = {
            // project_id: projectId,
            title: `${biz_type || 'Chat'} ${new Date().toLocaleString()}`,
            status: 'ACTIVE',
        };

        const resp = await http.post<LLMSessionRecord>('/llm/session/create', payload);
        const created = resp.data;
        if (!created?.id) {
            return null;
        }

        setSessionMap((prev) => ({
            ...prev,
            [String(created.id)]: created,
        }));
        setConversationItems((prev) => [toConversationItem(created), ...prev]);
        setActiveConversationKey(String(created.id));
        activeSessionIdRef.current = String(created.id);
        skipNextAutoLoadSessionKeyRef.current = String(created.id);
        setMessages([]);
        return created;
    }, [resolveProjectId, messageApi, biz_type, toConversationItem, setMessages]);

    const deleteActiveSession = React.useCallback(async () => {
        if (!activeConversationKey) {
            return;
        }

        const session = sessionMap[activeConversationKey];
        if (!session) {
            return;
        }

        await http.post('/llm/session/delete', { id: session.id });

        setSessionMap((prev) => {
            const next = { ...prev };
            delete next[activeConversationKey];
            return next;
        });
        setConversationItems((prev) => prev.filter((item) => String(item.key) !== activeConversationKey));

        const remained = Object.entries(sessionMap)
            .filter(([key]) => key !== activeConversationKey)
            .map(([, val]) => val)
            .sort((a, b) => b.id - a.id);

        if (remained.length > 0) {
            const next = remained[0];
            setActiveConversationKey(String(next.id));
            activeSessionIdRef.current = String(next.id);
            await loadConversationMessages(next.id);
        } else {
            setActiveConversationKey('');
            activeSessionIdRef.current = '';
            dispatch(setUserItem({ activeLLMSessionId: null }))
            setMessages([]);
        }
    }, [activeConversationKey, dispatch, sessionMap, loadConversationMessages, setMessages]);
    // const [defaultMessages, setDefaultMessages] = React.useState<any>([])
    const loadHistoryMessage = React.useCallback(async () => {
        await loadSessionList();

        const currentKey = activeConversationKeyRef.current;
        const active = sessionMapRef.current[currentKey];
        if (!active || !active.id) {
            return;
        }

        activeSessionIdRef.current = String(active.id);
        await loadConversationMessages(active.id);
    }, [loadSessionList, loadConversationMessages]);

    useEffect(() => {
        loadSessionList().catch(() => {
            // ignore initial load failure; global interceptor already handles messages
        });
    }, [loadSessionList]);

    useEffect(() => {
        if (!activeConversationKey) {
            return;
        }

        if (skipNextAutoLoadSessionKeyRef.current === activeConversationKey) {
            skipNextAutoLoadSessionKeyRef.current = '';
            return;
        }

        const active = sessionMapRef.current[activeConversationKey];
        if (!active) {
            return;
        }
        activeSessionIdRef.current = String(active.id);
        loadConversationMessages(active.id).catch(() => {
            // ignore load errors here
        });
    }, [activeConversationKey, loadConversationMessages]);

    useImperativeHandle(ref, () => ({
        loadHistoryMessage
    }))
    const env = React.useMemo(() => {
        if (analysisNodeId) {
            return {
                id: analysisNodeId,
                type: "analsyisNode"
            }
        } else if (script) {
            return {
                id: script?.id,
                type: "script"
            }
        }
        return {}
    }, [script,analysisNodeId])

    const EnvTag = React.useMemo(() => {
        if (!env) return <></>
        // if (env?.type == "script") {
        //     return <Tag color='processing'>{`${env?.type}`}({env?.id})</Tag>
        // }
        return  <Tag color='processing'>{`${env?.type}`}({env?.id})</Tag>
    }, [env])

    return (
        <Flex
            vertical
            style={{
                height: '100%',
                minHeight: 0,
                padding: '4px 2px 2px 2px',
            }}
        >
            <Flex
                justify='space-between'
                align='center'
                style={{
                    flexShrink: 0,
                    padding: '2px 4px 8px 4px',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                    marginBottom: 8,
                }}
            >
                {/* {JSON.stringify(env)} */}
                <div>
                    {EnvTag}


                </div>
                <Space>
                    <Button size='small' icon={<PlusOutlined />} onClick={async () => {
                        try {
                            await createSession();
                        } catch {
                            messageApi.error('Failed to create session');
                        }
                    }} />
                    <Popover
                        placement='bottomRight'
                        styles={{ body: { padding: 0, maxHeight: 420, overflow: 'auto' } }}
                        content={
                            <Conversations
                                items={conversationItems}
                                activeKey={activeConversationKey}
                                groupable
                                onActiveChange={(key) => {
                                    setActiveConversationKey(String(key || ''));
                                }}
                                style={{ width: 320 }}
                            />
                        }
                    >
                        <Button size='small' icon={<CommentOutlined />} disabled={!conversationItems.length} />
                    </Popover>
                    <Button size='small' icon={<RedoOutlined />} onClick={loadHistoryMessage} />
                    <Popconfirm title="Delete current session?" onConfirm={async () => {
                        try {
                            await deleteActiveSession();
                            messageApi.success('Session deleted');
                        } catch {
                            messageApi.error('Failed to delete session');
                        }
                    }}>
                        <Button size='small' icon={<DeleteOutlined />} danger disabled={!activeConversationKey} />
                    </Popconfirm>
                    {/* <Popconfirm title="Clear current chat view?" onConfirm={() => {
                        setMessages([]);
                    }}>
                        <Button size='small' icon={<ClearOutlined />} />
                    </Popconfirm> */}
                </Space>
            </Flex>

            <Flex vertical style={{ flex: 1, minHeight: 0 }}>
                <div
                    style={{
                        flex: 1,
                        minHeight: 0,
                        overflowY: 'auto',
                        paddingRight: 4,
                        marginBottom: 8,
                    }}
                >
                    <Bubble.List
                        role={roles(setMessage, loadHistoryMessage, thoughtChainItems, expandedKeys, setExpandedKeys)}
                        items={messages.map(({ id, message, status }) => {
                            return {
                                key: id,
                                loading: status === 'loading',
                                role: message.role,
                                content: message,
                            }
                        })}
                    />

                </div>

                {/* 发送器：用户输入区域，支持发送消息和中止请求 */}
                {/* Sender: user input area, supports sending messages and aborting requests */}
                <div
                    style={{
                        flexShrink: 0,
                        position: 'sticky',
                        bottom: 0,
                        zIndex: 1,
                        background: token.colorBgContainer,
                        borderTop: `1px solid ${token.colorBorderSecondary}`,
                        paddingTop: 8,
                    }}
                >
                    <Sender
                        loading={isRequesting}
                        value={content}
                        onChange={setContent}
                        onCancel={abort}
                        placeholder={"Please ask me questions related to bioinformatics ..."}
                        onSubmit={async (nextContent) => {
                            const trimmed = (nextContent || '').trim();
                            if (!trimmed) {
                                return;
                            }

                            let active = sessionMap[activeConversationKey];
                            if (!active) {
                                try {
                                    const created = await createSession();
                                    if (!created) {
                                        messageApi.error('Unable to create session');
                                        return;
                                    }
                                    active = created;
                                } catch {
                                    messageApi.error('Unable to create session');
                                    return;
                                }
                            }

                            setThoughtChainItems([])
                            onRequest({
                                stream: true,
                                role: 'user',
                                message: trimmed,
                                biz_id: biz_id,
                                biz_type: biz_type,
                                project_id: active.project_id || currentProjectId,
                                session_id: active.id,
                                is_save_prompt: true,
                                env: env
                                // ...(script ? {
                                //     env: {
                                //         script_id: script?.id,
                                //         type: "script",
                                //     }
                                // } : {})
                            });
                            setContent('');
                        }}
                    />
                </div>
            </Flex>
        </Flex>
    );
})

export default App;