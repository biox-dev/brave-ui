import { Typography } from "antd";
import { FC, useMemo } from "react";

// 节点的 request_param 以 JSON 字符串落库（analysis_nodes.request_param），
// 不同节点可能存空串、"{}" 或历史脏数据：
// - 空串 / "{}" 视为没有参数，给出明确提示而不是空白弹窗；
// - 非法 JSON 原样展示，避免查看时直接抛错看不到内容；
// - 对象（部分接口已解析）直接格式化输出。
const formatRequestParam = (raw: unknown): string => {
    if (raw == null) {
        return "";
    }
    if (typeof raw === "string") {
        const text = raw.trim();
        if (!text) {
            return "";
        }
        try {
            return JSON.stringify(JSON.parse(text), null, 2);
        } catch {
            return text;
        }
    }
    try {
        return JSON.stringify(raw, null, 2);
    } catch {
        return String(raw);
    }
};

const NodeRequestParam: FC<any> = ({ node }) => {
    const text = useMemo(() => formatRequestParam(node?.request_param), [node?.request_param]);
    const isEmptyParam = text === "" || text === "{}";

    return (
        <Typography>
            <pre style={{ margin: 0, maxHeight: "60vh", overflow: "auto" }}>
                {isEmptyParam ? "No request_param for this node" : text}
            </pre>
        </Typography>
    );
};

export default NodeRequestParam;
