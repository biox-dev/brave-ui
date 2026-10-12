import { invoke } from "@/core/ui-system/invokeV2";
import { Button } from "antd";
import { FC } from "react";

const SheetButton: FC<{ file_id?: string; file_name?: string }> = ({ file_id, file_name }) => {
    const label = file_name || "Sheet Preview";

    return (<>
        <Button size="small" disabled={!file_id} onClick={() => {
            invoke.univerView.open({ file_id }, {
                width: "90%",
                title: label,
                footer: null,
            })
        }}>{label}</Button>
    </>)
}
export default SheetButton;