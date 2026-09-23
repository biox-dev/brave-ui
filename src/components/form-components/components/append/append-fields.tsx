// src/components/form-components/components/append/append-fields.tsx
// Renders the `append` array of a repeatable component.
//
// The three call sites (NestSelectAssay, NestSelectAssayV2,
// CollectedAssaySelect) differ only in the name prefix they hand to the child
// and in whether the parent's own props are forwarded:
//
//   • NestSelectAssay / CollectedAssaySelect → prefix only
//   • NestSelectAssayV2                       → prefix + inherited props for the
//                                                CollectedAssaySelectV2 child
//
// Only the `Base*` children are hard-coded here because that is exactly what
// the parent implementations support — see `registry/meta.ts → appendTypes`.
import { FC } from "react";
import { BaseInput } from "../base/base-input";
import { BaseInputNumber } from "../base/base-input-number";
import { BaseSelect } from "../base/base-select";
import { BaseTextAreaNum } from "../base/base-textarea-num";
import { CollectedAssaySelectV2 } from "../collected/collected-assay-select-v2";
import type { JSONMap } from "@/components/form-components/registry";

export const AppendFields: FC<{
  /** The parent's `append` array. */
  append?: any;
  /** Path prefix prepended to each child's own `name`. */
  prefix: any[];
  /**
   * Which children the parent knows how to render. `"v2"` additionally allows a
   * `CollectedAssaySelectV2` child (NestSelectAssayV2 only) and forwards the
   * parent's props to it.
   */
  variant?: "basic" | "v2";
  /** Props forwarded to a `CollectedAssaySelectV2` child only. */
  inherited?: JSONMap;
}> = ({ append, prefix, variant = "basic", inherited }) => {
  if (!append || !Array.isArray(append)) return null;

  return (
    <>
      {append.map((item: any, index: number) => {
        const { name, type, ...rest } = item;
        const childName = [...prefix, name];
        return (
          <div key={index}>
            {variant === "v2" && type == "CollectedAssaySelectV2" && (
              <CollectedAssaySelectV2 {...inherited} {...rest} name={childName} />
            )}
            {type == "BaseTextAreaNum" && <BaseTextAreaNum name={childName} {...rest} />}
            {type == "BaseSelect" && <BaseSelect name={childName} {...rest} />}
            {type == "BaseInput" && <BaseInput name={childName} {...rest} />}
            {type == "BaseInputNumber" && <BaseInputNumber name={childName} {...rest} />}
          </div>
        );
      })}
    </>
  );
};

export default AppendFields;
