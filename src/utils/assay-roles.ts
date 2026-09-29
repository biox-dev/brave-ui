// src/utils/assay-roles.ts
// Shared role vocabulary. `go_assay.role` and an analysis form input's
// `resolver.accept_formats` speak the same language (an assay role is matched
// against an input's accepted formats), so both editors read their option list
// from here instead of keeping private copies.

/** Roles describing how a sequencing assay was generated. */
export const ASSAY_ROLE_OPTIONS = [
  { label: "WGS_SHORT_READ", value: "WGS_SHORT_READ" },
  { label: "WGS_LONG_READ", value: "WGS_LONG_READ" },
  { label: "WES_SHORT_READ", value: "WES_SHORT_READ" },
  { label: "RNA_SEQ_SHORT_READ", value: "RNA_SEQ_SHORT_READ" },
  { label: "RNA_SEQ_LONG_READ", value: "RNA_SEQ_LONG_READ" },
];
