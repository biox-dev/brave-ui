import { create } from "zustand";

// 每种组件暴露的能力（类型可扩展）
export type TableInstance = { reload: () => void; loadLastPage: () => void; search: (kw: string) => void };
export type DrawerInstance = { open: () => void; close: () => void };
export type ModalInstance = { open: () => void; close: () => void; setLoading: (v: boolean) => void };
export type FormInstance = { reload: () => void; setValue: (name: string, v: any) => void; reset: () => void, updateFormStatus: () => void };
export type ChartInstance = { refresh: () => void };

/**
 * 允许多个实例同时注册在同一 category + id 上的类目。
 *
 * 这些类目里，同一个 id（通常是 "*"）可能被多个面板实例注册（左栏分栈布局、
 * 弹窗与左栏共存、HMR 重挂载等）。用 Set 保存，避免一个实例卸载时把其它
 * 仍在挂载的监听者一并删掉（那会让后端推送的实时事件静默丢失）。
 */
const MULTI_INSTANCE_CATEGORIES = new Set<string>([
    "analysis",
    "container-terminal-session",
    // 容器队列状态可能同时被页脚徽标 / 其它面板监听，后端广播事件应推给全部实例。
    "container-queue",
]);

const isMultiCategory = (category: string) => MULTI_INSTANCE_CATEGORIES.has(category);

// 统一的组件 store
export type ComponentStore = {
    tables: Record<string, TableInstance>;
    drawers: Record<string, DrawerInstance>;
    modals: Record<string, ModalInstance>;
    forms: Record<string, FormInstance>;
    charts: Record<string, ChartInstance>;
    analysis: Record<string, Set<any>>; 
    "app-session": Record<string, any>;
    "container-terminal-session": Record<string, Set<any> | any>;
    "container-queue": Record<string, Set<any> | any>;
    "analysis-node": Record<string, any>;
    "ai-summary": Record<string, any>;
    graph: Record<string, any>; 
    store: Record<string, any>;
    container: Record<string, any>;

    register: <T>(category: keyof ComponentStore, id: string, instance: T) => void;
    unregister: <T>(category: keyof ComponentStore, id: string, instance?: T) => void;
    print: () => ComponentStore;
    invoke: (category: keyof ComponentStore, id: string, method: string, args?: any[]) => void;
};

export const useComponentStore = create<ComponentStore>((set, get) => ({
    tables: {},
    drawers: {},
    modals: {},
    forms: {},
    charts: {},
    analysis: {},
    "app-session": {},
    "container-terminal-session": {},
    "container-queue": {},
    "analysis-node": {},
    "ai-summary": {},
    graph: {},
    store:{},
    container: {},

    print:()=>{
        return get()
    },
    register: (category, id, instance) => {
        console.log(`Registering component - Category: ${category}, ID: ${id}`);
        // set((state) => ({
        //     [category]: { ...(state as any)[category], [id]: instance },
        // }))

        set((state) => {
            const map = { ...(state as any)[category] };


            // ⭐ multi
            if (isMultiCategory(category)) {
                // debugger
                if (!map[id]) {
                    map[id] = new Set();
                }
                map[id].add(instance);
            } else {
                // ⭐ single
                map[id] = instance;
            }

            return { [category]: map };
        });
    },

    unregister: (category, id, instance = undefined) => {
        console.log(`Unregistering component - Category: ${category}, ID: ${id}`);
        // set((state) => {
        //     const map = { ...(state as any)[category] };
        //     delete map[id];
        //     return { [category]: map };
        // })

        set((state) => {
            const map = { ...(state as any)[category] };

            if (isMultiCategory(category)) {
                const setInst = map[id];
                if (setInst) {
                    if (instance) {
                        setInst.delete(instance);
                    }
                    // 只有当集合里已经没有监听者时才删除这个 key。
                    // 否则一个面板实例卸载会把其它仍在挂载的实例一并清掉，
                    // 导致后端推送的实时事件全部静默丢失（例如终端会话列表不刷新）。
                    if (setInst.size === 0) {
                        delete map[id];
                    }
                }
            } else {
                delete map[id];
            }

            return { [category]: map };
        });
    },

    invoke: (category, id, method, args = []) => {
        // debugger
        console.log(`Invoking method on component - Category: ${category}, ID: ${id}, Method: ${method}, Args: ${JSON.stringify(args)}`);
        // const comp = (get() as any)[category]?.[id];
        // if (comp && typeof comp[method] === "function") {
        // if (args instanceof Array) {
        //     comp[method](...args);
        // } else {
        //     comp[method](args);
        // }
        //     // comp[method](...args);
        // }

        const globalTarget = (get() as any)[category]?.["*"];
        if (globalTarget) {
            // debugger
            if (globalTarget instanceof Set) {
                console.log(`Invoking globalTarget method on multiple instances - Count: ${globalTarget.size}`);
                for (const inst of globalTarget) {
                    const fn = inst[method];
                    if (typeof fn === "function") {
                        if (args instanceof Array) {
                            fn(...args);
                        } else {
                            fn(args);
                        }
                    }
                }
            }else{
                const fn = globalTarget[method];
                if (typeof fn === "function") {
                    if (args instanceof Array) {
                        fn(...args);
                    } else {
                        fn(args);
                    }
                }
            }
        }

        const target = (get() as any)[category]?.[id];
        if (!target) return;
        // console.log(`Found target for invocation - Category: ${category}, ID: ${id}`, target);
        // ⭐ 核心：if 判断 single / multi
        if (target instanceof Set) {
            console.log(`Invoking method on multiple instances - Count: ${target.size}`);
            for (const inst of target) {
                // debugger
                const fn = inst[method];
                if (typeof fn === "function") {
                    // fn(...args);
                    if (args instanceof Array) {
                        fn(...args);
                    } else {
                        fn(args);
                    }
                }
            }
        } else {
            const fn = target[method];
            if (typeof fn === "function") {
                // fn(...args);
                if (args instanceof Array) {
                    fn(...args);
                } else {
                    fn(args);
                }

            }
        }



    },
}));