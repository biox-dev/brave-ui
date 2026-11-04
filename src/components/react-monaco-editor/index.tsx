import { Drawer, Skeleton } from "antd";
import { FC, lazy, Suspense } from "react";
const MonacoEditorComp = lazy(() => import('./editor'));
// import  MonacoEditorComp from './editor'



export const MonacoEditor: FC<any> = ({
    onChange,
    value,
    editorRef,
    defaultLanguage,
    language,
    format,
    height,
    options,
    path,
    onEditorMount,
}) => {
    return <>
        <Suspense fallback={<Skeleton active paragraph={{ rows: 12 }}></Skeleton>}>
            
            <MonacoEditorComp
                onChange={onChange}
                value={value}
                editorRef={editorRef}
                defaultLanguage={defaultLanguage}
                language={language}
                format={format}
                height={height}
                options={options}
                path={path}
                onEditorMount={onEditorMount}
            > </MonacoEditorComp>

        </Suspense>
    </>
}

const MonacoEditorModal: FC<any> = ({ visible, onClose, value, editorRef, defaultLanguage, language, format, height, options, path }) => {
    if (!visible) return null;
    return <Drawer open={visible} onClose={onClose}>
        <MonacoEditor
            value={value}
            editorRef={editorRef}
            defaultLanguage={defaultLanguage}
            language={language}
            format={format}
            height={height}
            options={options}
            path={path}
        />
    </Drawer>
}

export default MonacoEditorModal