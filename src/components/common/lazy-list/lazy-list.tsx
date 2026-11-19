import { FC } from "react";
import { Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import "./lazy-list.css";

/** 懒加载列表统一搜索框：输入即过滤（防抖由 useLazyList 负责）。 */
export interface LazyListSearchProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	className?: string;
	disabled?: boolean;
}

export const LazyListSearch: FC<LazyListSearchProps> = ({
	value,
	onChange,
	placeholder,
	className,
	disabled,
}) => (
	<Input
		size="small"
		allowClear
		disabled={disabled}
		prefix={<SearchOutlined />}
		value={value}
		placeholder={placeholder}
		className={`lazy-list-search${className ? ` ${className}` : ""}`}
		onChange={(event) => onChange(event.target.value)}
	/>
);

/** 懒加载列表底部状态：加载中 / 没有更多。 */
export interface LazyListFooterProps {
	loadingMore: boolean;
	hasMore: boolean;
	/** 是否已经有一条数据（为空时通常由列表自身渲染 Empty）。 */
	hasItems: boolean;
	total?: number;
	labels?: { loading?: string; noMore?: string; totalPrefix?: string };
}

export const LazyListFooter: FC<LazyListFooterProps> = ({
	loadingMore,
	hasMore,
	hasItems,
	total,
	labels,
}) => {
	if (!hasItems) {
		return null;
	}
	if (loadingMore) {
		return (
			<div className="lazy-list-footer">
				<Spin size="small" />
				<span>{labels?.loading ?? ""}</span>
			</div>
		);
	}
	if (!hasMore) {
		return (
			<div className="lazy-list-footer lazy-list-footer-end">
				{labels?.noMore ?? ""}
				{typeof total === "number" && total > 0 && labels?.totalPrefix
					? ` · ${labels.totalPrefix}${total}`
					: ""}
			</div>
		);
	}
	return <div className="lazy-list-footer" />;
};

/** 底部哨兵：不可见，进入视口时由 useLazyList 自动加载下一页。 */
export interface LazyListSentinelProps {
	sentinelRef: (node: HTMLElement | null) => void;
}

export const LazyListSentinel: FC<LazyListSentinelProps> = ({ sentinelRef }) => (
	<div ref={sentinelRef} className="lazy-list-sentinel" aria-hidden />
);
