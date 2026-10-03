/**
 * 将一段完整的 HTML 文档通过隐藏 iframe 送入浏览器打印流程，
 * 用户可在打印对话框中选择「另存为 PDF」。
 *
 * 配合后端「内嵌图片（base64）」版本的 HTML 使用时无需任何网络请求，
 * 可完全离线导出，且保留矢量文字与中文字体。
 */
export const printHtmlDocument = (html: string): void => {
	if (!html) {
		return;
	}

	const iframe = document.createElement("iframe");
	iframe.setAttribute("aria-hidden", "true");
	// 离屏但保留可打印布局，避免影响当前页面。
	iframe.style.position = "fixed";
	iframe.style.right = "0";
	iframe.style.bottom = "0";
	iframe.style.width = "0";
	iframe.style.height = "0";
	iframe.style.border = "0";

	let printed = false;
	const cleanup = () => {
		// 延迟移除，确保打印对话框已获取到 iframe 文档。
		window.setTimeout(() => iframe.remove(), 1000);
	};

	const triggerPrint = () => {
		if (printed) {
			return;
		}
		printed = true;
		const win = iframe.contentWindow;
		if (!win) {
			cleanup();
			return;
		}
		win.focus();
		win.print();
		cleanup();
	};

	iframe.onload = triggerPrint;
	// 兜底：个别浏览器对 srcdoc 的 load 事件触发不稳定。
	window.setTimeout(triggerPrint, 1500);

	iframe.srcdoc = html;
	document.body.appendChild(iframe);
};
