// src/components/form-components/core/depends.ts
// Conditional visibility of a form item. `depends` can be a flat array (legacy
// AND), an explicit `{ and: [...] }` / `{ or: [...] }` tree, or a single
// `{ name, value }` condition.

export const checkDepends = (depends: any, getFieldValue: any): boolean => {
  if (!depends) return true;

  // ---------- legacy: array of { name, value }, grouped per name (AND) ------
  if (Array.isArray(depends)) {
    const group: Record<string, any[]> = {};

    depends.forEach((d) => {
      if (!group[d.name]) {
        group[d.name] = [];
      }
      group[d.name].push(d.value);
    });

    return Object.entries(group).every(([name, values]) =>
      values.includes(getFieldValue(name))
    );
  }

  // ---------- OR ----------------------------------------------------------
  if (depends.or) {
    return depends.or.some((d: any) => checkDepends(d, getFieldValue));
  }

  // ---------- AND ---------------------------------------------------------
  if (depends.and) {
    return depends.and.every((d: any) => checkDepends(d, getFieldValue));
  }

  // ---------- single condition -------------------------------------------
  if (depends.name) {
    return getFieldValue(depends.name) === depends.value;
  }

  return true;
};

/** Every field name a `depends` tree watches — used to scope `shouldUpdate`. */
export const extractDependsNames = (depends: any): string[] => {
  if (!depends) return [];

  if (Array.isArray(depends)) {
    return depends.map((d) => d.name);
  }

  if (depends.or) {
    return depends.or.flatMap(extractDependsNames);
  }

  if (depends.and) {
    return depends.and.flatMap(extractDependsNames);
  }

  if (depends.name) {
    return [depends.name];
  }

  return [];
};
