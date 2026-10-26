import { Card } from "antd";
import AISummaryProjectList from "@/components/layout-sider/ai-summary/ai-summary-project-list";

/**
 * AI 摘要页。
 *
 * 入口已从左侧活动栏迁移到设置菜单（`/ai-summary`），因此这里以整页形式渲染列表；
 * 选择器形态（通过 invoke 打开的弹窗）仍复用同一个 `AISummaryProjectList` 组件。
 */
const AISummaryPage = () => (
  <Card size="small" styles={{ body: { padding: 0 } }}>
    <AISummaryProjectList />
  </Card>
);

export default AISummaryPage;
