// src/components/script/io-schema-editor/editors/list-editor.tsx
// Editor for one io_schema list (`inputs` / `params` / `outputs`).
//
// Identity of the handlers matters here: the list array changes on every edit,
// so the callbacks are kept stable (they read the newest list from a ref) and
// each row is memoized. Without that, a keystroke in row 1 would re-render
// every row of every list.
import { Button, Empty, Flex, Select, Tag, Tooltip, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { FC, Fragment, memo, useCallback, useMemo, useRef, useState } from "react";
import {
  DEFAULT_COMPONENT_TYPE,
  createSchemaItem,
  groupedComponentTypeOptions,
  FORM_COMPONENT_TYPES,
} from "@/components/form-components/registry";
import { SchemaItemCard } from "./schema-item-card";
import type { JSONList, JSONMap } from "../types";

const ListEditorInner: FC<{
  listKey: string;
  list: JSONList;
  onChange: (list: JSONList) => void;
}> = ({ listKey, list, onChange }) => {
  const isOutput = listKey === "outputs";
  const [newType, setNewType] = useState<string>(DEFAULT_COMPONENT_TYPE);

  // `list` changes identity on every edit, but the handlers below must not, or
  // every memoized row would re-render on each keystroke.
  const listRef = useRef(list);
  listRef.current = list;

  const onPatch = useCallback(
    (index: number, next: JSONMap) => {
      const copy = [...listRef.current];
      copy[index] = next;
      onChange(copy);
    },
    [onChange]
  );

  const onRemove = useCallback(
    (index: number) => onChange(listRef.current.filter((_, i) => i !== index)),
    [onChange]
  );

  const onMove = useCallback(
    (index: number, dir: -1 | 1) => {
      const target = index + dir;
      const source = listRef.current;
      if (target < 0 || target >= source.length) return;
      const copy = [...source];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      onChange(copy);
    },
    [onChange]
  );

  const addItem = useCallback(
    (type?: string) => onChange([...listRef.current, createSchemaItem(type, listKey)]),
    [listKey, onChange]
  );

  // Insert a fresh item right below the card at `index` — without this a new
  // component could only ever be appended to the end of the list.
  const insertAfter = useCallback(
    (index: number) => {
      const copy = [...listRef.current];
      copy.splice(index + 1, 0, createSchemaItem(isOutput ? undefined : newType, listKey));
      onChange(copy);
    },
    [isOutput, listKey, newType, onChange]
  );

  const singular = listKey.slice(0, -1);

  // Duplicate `name`s silently overwrite each other in `formatIOSchemaItems`
  // (the backend keys inputs/outputs by name), so surface them early.
  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    list.forEach((item) => {
      const name = item?.name;
      if (typeof name !== "string" || !name) return;
      if (seen.has(name)) dup.add(name);
      seen.add(name);
    });
    return [...dup];
  }, [list]);

  // Guard against a component type that was removed from the catalogue.
  const unknownTypes = useMemo(
    () =>
      isOutput
        ? []
        : [
            ...new Set(
              list
                .map((item) => item?.type)
                .filter((type): type is string => typeof type === "string" && !!type)
                .filter((type) => !FORM_COMPONENT_TYPES.includes(type))
            ),
          ],
    [isOutput, list]
  );

  return (
    <Flex vertical gap={8}>
      <Flex justify="space-between" align="center" wrap gap={8}>
        <Flex gap={8} align="center" wrap>
          <Typography.Text type="secondary">{list.length} item(s)</Typography.Text>
          {duplicates.length > 0 && (
            <Tooltip title="重名的组件会互相覆盖（后端按 name 作为 key）">
              <Tag color="red">duplicate name: {duplicates.join(", ")}</Tag>
            </Tooltip>
          )}
          {unknownTypes.length > 0 && (
            <Tooltip title="不在组件目录中，运行时渲染为「未知类型」">
              <Tag color="orange">unknown type: {unknownTypes.join(", ")}</Tag>
            </Tooltip>
          )}
        </Flex>

        <Flex gap={8} align="center">
          {!isOutput && (
            <Select
              size="small"
              showSearch
              style={{ width: 220 }}
              value={newType}
              optionFilterProp="label"
              options={groupedComponentTypeOptions}
              onChange={setNewType}
            />
          )}
          <Button
            size="small"
            type="primary"
            ghost
            icon={<PlusOutlined />}
            onClick={() => addItem(isOutput ? undefined : newType)}
          >
            Add {singular}
          </Button>
        </Flex>
      </Flex>

      {list.length === 0 && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`No ${listKey} yet`} />
      )}

      {list.map((item, index) => (
        <Fragment key={index}>
          <SchemaItemCard
            listKey={listKey}
            item={item}
            index={index}
            total={list.length}
            onPatch={onPatch}
            onRemove={onRemove}
            onMove={onMove}
          />
          <Tooltip title={`Insert a new ${singular} below this component`}>
            <Button
              size="small"
              type="dashed"
              block
              icon={<PlusOutlined />}
              style={{ color: "rgba(0, 0, 0, 0.45)" }}
              onClick={() => insertAfter(index)}
            >
              Add {singular} below
            </Button>
          </Tooltip>
        </Fragment>
      ))}
    </Flex>
  );
};

export const ListEditor = memo(ListEditorInner);

export default ListEditor;
