// src/components/form-components/core/component-map.tsx
// `type` → `{ Component, ...props }`.
//
// The map is *derived*, not hand written: the catalogue (`registry/meta.ts`)
// says which type exists and which renderer-only props it needs, and
// `components/index.ts` supplies the implementation. Adding a component
// therefore only touches those two files — and the visual editor picks it up
// automatically because it reads the same catalogue.
import type { FC } from "react";
import { COMPONENT_IMPLEMENTATIONS } from "../components";
import { COMPONENT_META } from "../registry/meta";

export interface ComponentMapEntry {
  /** The React component that renders this type. */
  Component: FC<any>;
  /** Fallback data key used by `ComponentsRender` when the item has none. */
  dataKey?: string;
  /** Extra props forwarded to the component (the item's own props win). */
  mode?: any;
  initialValue?: any;
}

export const componentMap: Record<string, ComponentMapEntry> = Object.fromEntries(
  COMPONENT_META.map((meta) => [
    meta.type,
    {
      Component: COMPONENT_IMPLEMENTATIONS[meta.type],
      ...(meta.renderProps ?? {}),
    },
  ])
);

export default componentMap;
