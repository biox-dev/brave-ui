// src/components/form-components/index.ts
// Public surface of the form-json renderer.
//
// Layout
//   registry/   type catalogue: which component types exist and which
//               properties each of them supports (also used by the io_schema
//               editor in `script/io-schema-editor`)
//   components/ the implementations, grouped by domain
//   core/       depends / ComponentsRender / FormJsonComp / componentMap
//
// Everything below is re-exported for backwards compatibility: consumers
// historically imported `FormJsonComp` (default) and a few named components
// from `@/components/form-components`.
export { default } from "./core/form-json-comp";
export { FormJsonComp } from "./core/form-json-comp";
export { ComponentsRender } from "./core/components-render";
export { componentMap } from "./core/component-map";
export { checkDepends, extractDependsNames } from "./core/depends";

export * from "./components";
export * from "./registry";
