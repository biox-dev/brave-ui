

export const INPUTS = [
  {
    "label": "SeuratObject File",
    "name": "seuratObject",
    "type": "SelectSample",
    "input_type": "file",
    "component_id": "DEFAULT",
    "resolver": {
      "accept_formats": [
        "DEFAULT"
      ]
    },
    "mode": "none",
    "db": true,
    "rules": [
      {
        "required": true,
        "message": "need input!"
      }
    ]
  }, {
    "name": "x_input",
    "label": "X input",
    "db": true,
    "input_type": "file",
    "resolver": {
      "accept_formats": [
        "TABLE"
      ]
    },
    "component_id": "TABLE",
    "columns": [],
    "modes": [
      0
    ],
    "columns_rules": [
      0
    ],
    "rules": [
      {
        "required": true,
        "message": "This field cannot be empty!"
      }
    ],
    "type": "CollectedSampleSelect"
  }, {
    "label": "SeuratObjects  File",
    "name": "seuratObjects",
    "type": "NestSelectSample",
    "input_type": "file",
    "append": [
      {
        "name": "feature_genes",
        "label": "feature genes",
        "type": "BaseTextAreaNum",
        "initialValue": "",
        "tooltip": "Comma-separated gene list for FeaturePlot"
      }, {
        "name": "node_name",
        "label": "Cell type",
        "type": "BaseInput",
        "initialValue": "",
        "tooltip": "cell type"
      }
    ],
    "component_id": "TABLE",
    "resolver": {
      "accept_formats": [
        "TABLE"
      ]
    },
    "db": true,
    "rules": [
      {
        "required": true,
        "message": "\u8be5\u5b57\u6bb5\u4e0d\u80fd\u4e3a\u7a7a!"
      }
    ]
  }, {
    "label": "deg  File",
    "name": "degs",
    "input_type": "file",
    "type": "NestSelectSampleV2",
    "append": [
      {
        "name": "cell_type",
        "label": "cell_type",
        "type": "CollectedSampleSelectV2",
        "db": true,
        "input_type": "file",
        "initialValue": "",
        "tooltip": "cell_type"
      },
      {
        "name": "name",
        "label": "name",
        "type": "BaseInput",
        "initialValue": "",
        "tooltip": "name"
      }
    ],
    "component_id": "TABLE",
    "resolver": {
      "accept_formats": [
        "TABLE"
      ]
    },
    "db": true,
    "rules": [
      {
        "required": true,
        "message": "\u8be5\u5b57\u6bb5\u4e0d\u80fd\u4e3a\u7a7a!"
      }
    ]
  }, {
    "name": "phenos",
    "label": "Pheno Files",
    "db": true,
    "input_type": "file",
    "resolver": {
      "accept_formats": [
        "TABLE"
      ]
    },
    "component_id": "TABLE",
    "columns": [
      "pheno_name"
    ],
    "modes": [
      0
    ],
    "columns_rules": [
      0
    ],
    "rules": [
      {
        "required": true,
        "message": "This field cannot be empty!"
      }
    ],
    "type": "NestCollectedSampleSelect"
  }
]


export const softwareTemplete = {
  "databases": [
    {
      "name": "metaphlan_database",
      "dataKey": "metaphlan_database",
      "label": "metaphlan_database",
      "rules": [
        {
          "required": true,
          "message": "This field cannot be empty!"
        }
      ],
      "type": "BaseSelect"
    }
  ],
  "upstreamFormJson": [
    {
      "name": "stat_q",
      "data": [
        {
          "label": "0.2",
          "value": 0.2
        },
        {
          "label": "0",
          "value": 0
        }
      ],
      "initialValue": 0.2,
      "label": "Quantile value for the robust average(--stat_q)",
      "rules": [
        {
          "required": true,
          "message": "This field cannot be empty!"
        }
      ],
      "type": "BaseSelect"
    }
  ]
}

export const scriptTempleteV1 = {
  "formJson": [
    {
      "name": "x_input",
      "label": "x input",
      "component_id": "75087620-2ff8-4045-8694-a0c19aac12fc",
      "db": true,
      "group": "group_field",
      "type": "CollectedSampleSelect",
      "columns": [
        "sample_vars",
        "feature_var"
      ],
      "modes": [
        1,
        0
      ],
      "columns_rules": [
        1,
        1
      ],
      "rules": [
        {
          "required": true,
          "message": "This field cannot be empty!"
        }
      ]
    }
  ]
}

export const scriptTemplete = {
  "inputs": [
    {
      "label": "input1",
      "name": "input1",
      "type": "BaseInput",
      "required": true
    },
    {
      "label": "input2",
      "name": "input2",
      "type": "BaseInput",
      "required": true
    }

  ],
  "outputs": [
    {
      "name": "bam",
      "type": "file"
    }
  ],
  "params": [
    {
      "name": "params_name",
      "label": "params_name",
      "type": "BaseInput",
      "initialValue": "params_value",
    }

  ],
  "resources": {
    "cpu": 4,
    "memory": "6GB",
    // "docker": "quay.io/biocontainers/trim-galore:0.6.7"
  },
  "ui": {
    "icon": "scissors",
    "color": "green"
  }
}

export const fileTemplete = {
  "name": "raw_reads",
  "mode": "multiple",
  "type": "GroupSelectSampleButton",
  "label": "Raw Reads",
  "group": "group_field",
  "rules": [
    {
      "required": true,
      "message": "This field cannot be empty!"
    }
  ],
  "dir": "metaphlan",
  "fileFormat": {
    "profile": "*/*_profile.txt"
  },
  "inputForm": [
    {
      "name": [
        "content",
        "fastq1"
      ],
      "initialValue": "/data/wangyang/NGS_TEST/*_1.fastq.gz",
      "label": "fastq1",
      "type": "BaseInput",
      "rules": [
        {
          "required": true,
          "message": "This field cannot be empty!"
        }
      ]
    },
    {
      "name": [
        "content",
        "fastq2"
      ],
      "initialValue": "/data/wangyang/NGS_TEST/*_2.fastq.gz",
      "label": "fastq2",
      "type": "BaseInput",
      "rules": [
        {
          "required": true,
          "message": "This field cannot be empty!"
        }
      ]
    }
  ]
}