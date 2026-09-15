import type { ConfigSections } from "@/api/config";

/**
 * 配置段组件统一入参。
 *
 * `onSave` 成功时返回后端归一化后的值（可用于刷新表单），失败时抛出异常
 * （错误提示由 http 拦截器统一处理）。
 */
export interface ConfigSectionProps<T> {
	/** 当前生效的配置段内容，用于表单回填。 */
	value: T;
	onSave: (value: T) => Promise<T>;
}

/** 从 ConfigSections 推导某个配置段的类型。 */
export type SectionValue<K extends keyof ConfigSections> = ConfigSections[K];
