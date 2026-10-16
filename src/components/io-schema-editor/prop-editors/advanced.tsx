// src/components/script/io-schema-editor/prop-editors/advanced.tsx
// Whole-item raw JSON. Still the definitive escape hatch: anything the
// structured editors do not model survives a round-trip through this view.
// The surrounding card puts this editor inside a `Collapse` panel.
import { AdvancedJSONEditor } from "../shared/json-editor";
import type { PropEditor } from "../types";

export const AdvancedEditor: PropEditor = ({ item, patch }) => (
  <AdvancedJSONEditor value={item} onCommit={patch} rows={8} />
);

export default AdvancedEditor;
