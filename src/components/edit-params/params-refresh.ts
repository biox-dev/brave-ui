/**
 * 参数面板刷新信号
 * =================
 * 参数表单里有些控件（例如 `collected-file-list` 上传文件）在完成操作后需要让
 * 当前打开的参数面板重新拉一次表单数据。以前这件事靠 `RenderProvider.loadParams`
 * 把结果写进全局 `requestParam`，参数面板再从全局读——面板和页面之间是隐式耦合的。
 *
 * 现在参数面板按「目标」自己加载数据，只需要一个与业务无关的广播：
 * 谁想让参数面板刷新，就调用 `emitParamsRefresh()`；
 * 参数面板用 `onParamsRefresh()` 订阅（返回取消订阅函数）。
 */
type ParamsRefreshListener = () => void

const listeners = new Set<ParamsRefreshListener>()

export const onParamsRefresh = (listener: ParamsRefreshListener) => {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export const emitParamsRefresh = () => {
    listeners.forEach((listener) => {
        try {
            listener()
        } catch (error) {
            console.error("params refresh listener failed", error)
        }
    })
}
