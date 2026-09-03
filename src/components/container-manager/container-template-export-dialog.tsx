import { Button, Flex, Typography } from "antd";

export interface ContainerTemplateExportDialogProps {
    json: string;
    name?: string;
    // close is injected by UIContainer
    close?: () => void;
}

const ContainerTemplateExportDialog = ({
    json,
    name,
    close,
}: ContainerTemplateExportDialogProps) => {
    return (
        <div>
            <Typography.Paragraph
                copyable={{ text: json }}
                style={{ marginBottom: 8 }}
            >
                {name ? `Container Template: ${name}` : "Container Template Export"}
            </Typography.Paragraph>
            <pre
                style={{
                    maxHeight: 480,
                    overflow: "auto",
                    background: "#f5f5f5",
                    padding: 12,
                    borderRadius: 6,
                    fontSize: 12,
                    lineHeight: 1.5,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                }}
            >
                {json}
            </pre>
            <Flex justify="end" style={{ marginTop: 12 }}>
                <Button onClick={close}>Close</Button>
            </Flex>
        </div>
    );
};

export default ContainerTemplateExportDialog;
