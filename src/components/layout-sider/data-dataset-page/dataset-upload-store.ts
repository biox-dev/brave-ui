// 数据集文件上传会话（按 dataset_id 保存）。
//
// 上传状态不再放在弹窗组件里：弹窗被关闭（X / Esc / Cancel）后组件会卸载，
// 但上传仍然在后台继续，工具栏的 Upload 按钮据此显示进度，点击即可重新打开
// 弹窗继续查看进度；同时上传中注册 beforeunload 提示，刷新/关闭浏览器时由
// 浏览器弹出「离开 / 留下」确认框（浏览器不允许自定义文案）。
import { create } from "zustand";
import { uploadFileToDatasetApi } from "@/api/data";
import { getGlobalMessage } from "@/hooks/useGlobalMessage";

export type UploadStatus = "pending" | "uploading" | "done" | "error";

/** 同时在途的上传请求数，避免一次选中几十个文件时打爆浏览器/后端。 */
export const UPLOAD_CONCURRENCY = 3;

/** 同名同大小同修改时间视为同一个文件（重选时据此去重）。 */
export const uploadFileKey = (file: File) => `${file.name}:${file.size}:${file.lastModified}`;

export interface DatasetUploadSession {
  dataset_id: string;
  dataset_name: string;
  files: File[];
  statuses: Record<string, UploadStatus>;
  uploading: boolean;
  /** 全部上传成功，等待（打开着的）弹窗自行关闭。 */
  completed: boolean;
  percent: number;
  /** 本次成功上传的文件数（完成时回给 onOk）。 */
  succeeded: number;
}

type DatasetUploadStore = {
  sessions: Record<string, DatasetUploadSession>;
  /** 确保会话存在（重新打开弹窗时复用已有会话）。 */
  ensure: (datasetId: string, datasetName?: string) => void;
  /** 追加待上传文件（按 fileKey 去重）。 */
  addFiles: (datasetId: string, files: File[]) => void;
  /** 从待上传列表移除一个文件。 */
  removeFile: (datasetId: string, key: string) => void;
  /** 开始上传（后台执行，弹窗关闭也不中断）。 */
  start: (datasetId: string) => void;
  /** 取消上传：abort 所有在途请求并清掉会话。 */
  cancel: (datasetId: string) => void;
  /** 丢弃会话（上传完成 / 关闭弹窗时未在途）。 */
  dismiss: (datasetId: string) => void;
};

/** 每个数据集最近一次的上传完成回调（刷新文件列表），弹窗关闭后仍保留。 */
const uploadedCallbacks = new Map<string, () => void>();
/** 在途请求的 AbortController，取消上传时统一 abort。 */
const controllers = new Map<string, Set<AbortController>>();
/** 已请求取消的数据集，worker 据此停止继续取队列。 */
const cancelRequested = new Set<string>();
/** 打开中的上传弹窗数量：为 0 时上传完成不需要再给弹窗展示 completed 态。 */
const openDialogs = new Map<string, number>();

/** 弹窗挂载时登记（用于判断完成时是否有窗口可以展示进度）。 */
export const attachUploadDialog = (datasetId: string) => {
  openDialogs.set(datasetId, (openDialogs.get(datasetId) ?? 0) + 1);
};

/** 弹窗卸载时注销。 */
export const detachUploadDialog = (datasetId: string) => {
  const next = (openDialogs.get(datasetId) ?? 1) - 1;
  if (next > 0) {
    openDialogs.set(datasetId, next);
    return;
  }
  openDialogs.delete(datasetId);
};

/** 记录上传完成后的列表刷新回调（每次打开弹窗都会更新）。 */
export const setUploadCallback = (datasetId: string, callback?: () => void) => {
  if (callback) {
    uploadedCallbacks.set(datasetId, callback);
  }
};

export const useDatasetUploadStore = create<DatasetUploadStore>((set, get) => {
  const patch = (datasetId: string, updater: Partial<DatasetUploadSession>) => {
    set((state) => {
      const current = state.sessions[datasetId];
      if (!current) {
        return state;
      }
      return {
        sessions: { ...state.sessions, [datasetId]: { ...current, ...updater } },
      };
    });
  };

  const setStatus = (datasetId: string, key: string, status: UploadStatus) => {
    set((state) => {
      const current = state.sessions[datasetId];
      if (!current) {
        return state;
      }
      return {
        sessions: {
          ...state.sessions,
          [datasetId]: { ...current, statuses: { ...current.statuses, [key]: status } },
        },
      };
    });
  };

  const drop = (datasetId: string) => {
    uploadedCallbacks.delete(datasetId);
    set((state) => {
      if (!(datasetId in state.sessions)) {
        return state;
      }
      const sessions = { ...state.sessions };
      delete sessions[datasetId];
      return { sessions };
    });
  };

  const run = async (datasetId: string) => {
    const session = get().sessions[datasetId];
    if (!session || session.uploading || session.files.length === 0) {
      return;
    }

    const files = [...session.files];
    const total = files.reduce((sum, file) => sum + file.size, 0);
    const loaded: Record<string, number> = {};
    files.forEach((file) => {
      loaded[uploadFileKey(file)] = 0;
    });

    const abortSet = new Set<AbortController>();
    controllers.set(datasetId, abortSet);
    cancelRequested.delete(datasetId);

    patch(datasetId, {
      uploading: true,
      completed: false,
      percent: 0,
      succeeded: 0,
      statuses: Object.fromEntries(
        files.map((file) => [uploadFileKey(file), "pending" as UploadStatus])
      ),
    });

    const updatePercent = () => {
      const sum = Object.values(loaded).reduce((acc, value) => acc + value, 0);
      patch(datasetId, { percent: total > 0 ? Math.min(99, Math.round((sum / total) * 100)) : 0 });
    };

    const queue = [...files];
    const failedKeys = new Set<string>();
    let succeeded = 0;

    const worker = async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        // 已取消 / 会话已被移除：立刻停止取队列，不再发起新请求。
        if (cancelRequested.has(datasetId) || !get().sessions[datasetId]) {
          return;
        }
        const key = uploadFileKey(file);
        const controller = new AbortController();
        abortSet.add(controller);
        setStatus(datasetId, key, "uploading");
        try {
          await uploadFileToDatasetApi(
            { dataset_id: datasetId, file },
            (value) => {
              loaded[key] = Math.round((file.size * value) / 100);
              updatePercent();
            },
            controller.signal
          );
          loaded[key] = file.size;
          succeeded += 1;
          setStatus(datasetId, key, "done");
        } catch (error) {
          // 取消上传不算失败：会话已经被 cancel 移除，这里直接退出。
          if ((error as { code?: string })?.code === "ERR_CANCELED") {
            return;
          }
          failedKeys.add(key);
          setStatus(datasetId, key, "error");
        } finally {
          abortSet.delete(controller);
          updatePercent();
        }
      }
    };

    const workers = Math.min(UPLOAD_CONCURRENCY, queue.length);
    await Promise.all(Array.from({ length: workers }, () => worker()));
    controllers.delete(datasetId);

    if (cancelRequested.has(datasetId)) {
      cancelRequested.delete(datasetId);
      return;
    }

    const latest = get().sessions[datasetId];
    if (!latest) {
      return;
    }

    /** 弹窗还开着时才需要把结果留在会话里展示；关闭状态直接收尾。 */
    const dialogsOpen = (openDialogs.get(datasetId) ?? 0) > 0;

    if (failedKeys.size === 0) {
      uploadedCallbacks.get(datasetId)?.();
      getGlobalMessage()?.success?.(`Uploaded ${succeeded} file(s)`);
      if (dialogsOpen) {
        // 弹窗还开着：标记完成，由弹窗自己关闭并清理会话。
        patch(datasetId, { uploading: false, completed: true, percent: 100, succeeded });
      } else {
        // 弹窗已经关闭：后台传完直接清理，工具栏回到普通上传按钮。
        drop(datasetId);
      }
      return;
    }

    if (succeeded > 0) {
      uploadedCallbacks.get(datasetId)?.();
    }
    getGlobalMessage()?.warning?.(`Uploaded ${succeeded}, failed ${failedKeys.size}`);

    if (!dialogsOpen) {
      // 弹窗已关闭：没有界面可以重试，失败行不再保留。
      drop(datasetId);
      return;
    }

    // 部分失败：移除已成功的文件，保留失败行让用户重试。
    patch(datasetId, {
      uploading: false,
      completed: false,
      percent: 0,
      succeeded,
      files: latest.files.filter((file) => failedKeys.has(uploadFileKey(file))),
      statuses: Object.fromEntries(
        Array.from(failedKeys, (key) => [key, "error" as UploadStatus])
      ),
    });
  };

  return {
    sessions: {},

    ensure: (datasetId, datasetName) => {
      set((state) => {
        const current = state.sessions[datasetId];
        if (current) {
          if (datasetName && datasetName !== current.dataset_name) {
            return {
              sessions: {
                ...state.sessions,
                [datasetId]: { ...current, dataset_name: datasetName },
              },
            };
          }
          return state;
        }
        return {
          sessions: {
            ...state.sessions,
            [datasetId]: {
              dataset_id: datasetId,
              dataset_name: datasetName ?? "",
              files: [],
              statuses: {},
              uploading: false,
              completed: false,
              percent: 0,
              succeeded: 0,
            },
          },
        };
      });
    },

    addFiles: (datasetId, files) => {
      if (files.length === 0) {
        return;
      }
      get().ensure(datasetId);
      set((state) => {
        const current = state.sessions[datasetId];
        if (!current) {
          return state;
        }
        const merged = [...current.files];
        const statuses = { ...current.statuses };
        let changed = false;
        files.forEach((file) => {
          const key = uploadFileKey(file);
          if (!merged.some((item) => uploadFileKey(item) === key)) {
            merged.push(file);
            statuses[key] = "pending";
            changed = true;
          }
        });
        if (!changed) {
          return state;
        }
        return {
          sessions: {
            ...state.sessions,
            [datasetId]: { ...current, files: merged, statuses },
          },
        };
      });
    },

    removeFile: (datasetId, key) => {
      set((state) => {
        const current = state.sessions[datasetId];
        if (!current) {
          return state;
        }
        const statuses = { ...current.statuses };
        delete statuses[key];
        return {
          sessions: {
            ...state.sessions,
            [datasetId]: {
              ...current,
              files: current.files.filter((file) => uploadFileKey(file) !== key),
              statuses,
            },
          },
        };
      });
    },

    start: (datasetId) => {
      void run(datasetId);
    },

    cancel: (datasetId) => {
      if (!get().sessions[datasetId]) {
        return;
      }
      cancelRequested.add(datasetId);
      controllers.get(datasetId)?.forEach((controller) => controller.abort());
      controllers.delete(datasetId);
      drop(datasetId);
      getGlobalMessage()?.info?.("Upload cancelled");
    },

    dismiss: (datasetId) => {
      if (get().sessions[datasetId]?.uploading) {
        // 在途上传不允许丢弃会话，否则弹窗重新打开就看不到进度了。
        return;
      }
      drop(datasetId);
    },
  };
});

// 上传中刷新/关闭浏览器时提醒（浏览器统一弹出「离开 / 留下」确认框）。
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  event.preventDefault();
  // 现代浏览器忽略自定义文案，统一展示内置的离开确认；这里赋值兼容旧浏览器。
  event.returnValue = "";
};

const syncBeforeUnload = () => {
  if (typeof window === "undefined") {
    return;
  }
  const active = Object.values(useDatasetUploadStore.getState().sessions).some(
    (session) => session.uploading
  );
  if (active) {
    // 同一个函数引用重复 add 会被浏览器自动去重。
    window.addEventListener("beforeunload", handleBeforeUnload);
  } else {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  }
};

useDatasetUploadStore.subscribe(syncBeforeUnload);
