// src/components/script/io-schema-editor/shared/json-editor.tsx
import { Input, Typography } from "antd";
import { FC, useEffect, useRef, useState } from "react";

/**
 * Raw JSON editor: the escape hatch for anything the structured editors do not
 * cover. Local text is the source of truth while focused so an upstream
 * re-render cannot clobber what the user is typing; the parsed value is pushed
 * on blur only.
 */
export const AdvancedJSONEditor: FC<{
  value: any;
  onCommit: (value: any) => void;
  rows?: number;
  label?: string;
}> = ({ value, onCommit, rows = 8, label }) => {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string>();
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(JSON.stringify(value ?? {}, null, 2));
    setError(undefined);
  }, [value]);

  return (
    <>
      {label && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {label}
        </Typography.Text>
      )}
      <Input.TextArea
        value={text}
        rows={rows}
        spellCheck={false}
        status={error ? "error" : undefined}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          try {
            const parsed = text.trim() ? JSON.parse(text) : {};
            setError(undefined);
            onCommit(parsed);
          } catch (e: any) {
            setError(e?.message);
          }
        }}
      />
      {error && (
        <Typography.Text type="danger" style={{ fontSize: 12 }}>
          {error}
        </Typography.Text>
      )}
    </>
  );
};

export default AdvancedJSONEditor;
