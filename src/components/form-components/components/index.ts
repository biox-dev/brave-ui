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
import { CollectedGroupSelectAssayButton } from "./collected/collected-group-select-assay-button";
import { CollectedGroupSelectAssayButton2 } from "./collected/collected-group-select-assay-button2";
import { CollectedAssaySelect } from "./collected/collected-assay-select";
import { CollectedAssaySelectV2 } from "./collected/collected-assay-select-v2";
import { CollectedSimplpeGroupSelect } from "./collected/collected-simplpe-group-select";
import { NestCollectedColumnsSelect } from "./collected/nest-collected-columns-select";
import { NestCollectedAssaySelect } from "./collected/nest-collected-assay-select";
import { SimplpeGroupSelect } from "./collected/simplpe-group-select";
import { DifferenceAnalysisConditions } from "./params/difference-analysis-conditions";
import { HeatmapParams } from "./params/heatmap-params";
import { GroupSelectAssayButton } from "./assay/group-select-assay-button";
import { NestSelectAssay } from "./assay/nest-select-assay";
import { NestSelectAssayV2 } from "./assay/nest-select-assay-v2";
import { SelectAssay } from "./assay/select-assay";
import { FilterSelect } from "./select/filter-select";
import { GroupCompareSelect } from "./select/group-compare-select";
import { MetaphlanCladeSelect } from "./select/metaphlan-clade-select";
import { AppendFields } from "./append/append-fields";
import { BasicSelect } from "./shared/basic-select";
import { ColorPickerComp } from "./shared/color-picker";
import { GroupSelectButton } from "./shared/group-select-button";
import { GroupSelectAssay } from "./shared/group-select-assay";

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
  CollectedGroupSelectAssayButton,
  CollectedGroupSelectAssayButton2,
  CollectedAssaySelect,
  CollectedAssaySelectV2,
  CollectedSimplpeGroupSelect,
  ColorPickerComp,
  DifferenceAnalysisConditions,
  DividerComp,
  FilterSelect,
  GroupCompareSelect,
  GroupSelectButton,
  GroupSelectAssay,
  GroupSelectAssayButton,
  HeatmapParams,
  MetaphlanCladeSelect,
  NestCollectedColumnsSelect,
  NestCollectedAssaySelect,
  NestSelectAssay,
  NestSelectAssayV2,
  SelectAll,
  SelectAssay,
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
  SelectAssay,
  NestSelectAssay,
  NestSelectAssayV2,
  GroupSelectAssayButton,
  SimplpeGroupSelect,
  CollectedSimplpeGroupSelect,
  CollectedGroupSelectAssayButton,
  CollectedGroupSelectAssayButton2,
  CollectedAssaySelect,
  CollectedColumnsSelect,
  NestCollectedAssaySelect,
  NestCollectedColumnsSelect,
  MetaphlanCladeSelect,
  SelectAll,
  Divider: DividerComp,
  BaseColorPicker,
  ThreeColorPicker,
  DifferenceAnalysisConditions,
  HeatmapParams,
};
