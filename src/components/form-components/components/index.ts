// src/components/form-components/components/index.ts
// Every component implementation, plus the `type` → implementation table the
// renderer needs. The *descriptive* half of each entry (category, editable
// properties, defaults) lives in `../registry/meta.ts`.
import type { FC } from "react";

import { BaseColorPicker } from "./base/base-color-picker";
import { BaseInput } from "./base/base-input";
import { BaseInputNumber } from "./base/base-input-number";
import { BaseSelect } from "./base/base-select";
import { BaseSwitch } from "./base/base-switch";
import { BaseTextArea } from "./base/base-textarea";
import { BaseTextAreaNum } from "./base/base-textarea-num";
import { DividerComp } from "./base/divider";
import { SelectAll } from "./base/select-all";
import { ThreeColorPicker } from "./base/three-color-picker";
import { CollectedColumnsSelect } from "./collected/collected-columns-select";
import { CollectedGroupSelectSampleButton } from "./collected/collected-group-select-sample-button";
import { CollectedGroupSelectSampleButton2 } from "./collected/collected-group-select-sample-button2";
import { CollectedSampleSelect } from "./collected/collected-sample-select";
import { CollectedSampleSelectV2 } from "./collected/collected-sample-select-v2";
import { CollectedSimplpeGroupSelect } from "./collected/collected-simplpe-group-select";
import { NestCollectedColumnsSelect } from "./collected/nest-collected-columns-select";
import { NestCollectedSampleSelect } from "./collected/nest-collected-sample-select";
import { SimplpeGroupSelect } from "./collected/simplpe-group-select";
import { DifferenceAnalysisConditions } from "./params/difference-analysis-conditions";
import { HeatmapParams } from "./params/heatmap-params";
import { GroupSelectSampleButton } from "./sample/group-select-sample-button";
import { NestSelectSample } from "./sample/nest-select-sample";
import { NestSelectSampleV2 } from "./sample/nest-select-sample-v2";
import { SelectSample } from "./sample/select-sample";
import { FilterSelect } from "./select/filter-select";
import { GroupCompareSelect } from "./select/group-compare-select";
import { MetaphlanCladeSelect } from "./select/metaphlan-clade-select";
import { AppendFields } from "./append/append-fields";
import { BasicSelect } from "./shared/basic-select";
import { ColorPickerComp } from "./shared/color-picker";
import { GroupSelectButton } from "./shared/group-select-button";
import { GroupSelectSample } from "./shared/group-select-sample";

export {
  AppendFields,
  BaseColorPicker,
  BaseInput,
  BaseInputNumber,
  BaseSelect,
  BaseSwitch,
  BaseTextArea,
  BaseTextAreaNum,
  BasicSelect,
  CollectedColumnsSelect,
  CollectedGroupSelectSampleButton,
  CollectedGroupSelectSampleButton2,
  CollectedSampleSelect,
  CollectedSampleSelectV2,
  CollectedSimplpeGroupSelect,
  ColorPickerComp,
  DifferenceAnalysisConditions,
  DividerComp,
  FilterSelect,
  GroupCompareSelect,
  GroupSelectButton,
  GroupSelectSample,
  GroupSelectSampleButton,
  HeatmapParams,
  MetaphlanCladeSelect,
  NestCollectedColumnsSelect,
  NestCollectedSampleSelect,
  NestSelectSample,
  NestSelectSampleV2,
  SelectAll,
  SelectSample,
  SimplpeGroupSelect,
  ThreeColorPicker,
};

/**
 * `type` → component. Keys must match `COMPONENT_META[].type`; a missing entry
 * renders as "未知类型 <type>".
 */
export const COMPONENT_IMPLEMENTATIONS: Record<string, FC<any>> = {
  GroupSelect: BaseSelect,
  Input: BaseTextArea,
  BaseTextArea,
  BaseTextAreaNum,
  GroupCompareSelect,
  BaseSelect,
  BaseInputNumber,
  BaseInput,
  BaseSwitch,
  RankSelect: BaseSelect,
  GroupFieldSelect: BaseSelect,
  FilterFieldSelect: FilterSelect,
  SelectSample,
  NestSelectSample,
  NestSelectSampleV2,
  GroupSelectSampleButton,
  SimplpeGroupSelect,
  CollectedSimplpeGroupSelect,
  CollectedGroupSelectSampleButton,
  CollectedGroupSelectSampleButton2,
  CollectedSampleSelect,
  CollectedColumnsSelect,
  NestCollectedSampleSelect,
  NestCollectedColumnsSelect,
  MetaphlanCladeSelect,
  SelectAll,
  Divider: DividerComp,
  BaseColorPicker,
  ThreeColorPicker,
  DifferenceAnalysisConditions,
  HeatmapParams,
};
