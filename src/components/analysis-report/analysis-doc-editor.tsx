import { updateProjectReportItemContentApi, uploadProjectReportImageApi } from "@/api/project";
import { useGlobalMessage } from "@/hooks/useGlobalMessage";
import { UploadOutlined } from "@ant-design/icons";
import { Button, Collapse, Flex, Form, Typography } from "antd";
import type { editor as MonacoEditorNS } from "monaco-editor";
import { FC, useEffect, useRef, useState, type ChangeEvent } from "react";
import { MonacoEditor } from "../react-monaco-editor";

const AnalysisDocEditor: FC<any> = ({ item, onSaved }) => {
  const [form] = Form.useForm()
  const message = useGlobalMessage();
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isUploadingRef = useRef(false)
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    form.setFieldsValue({ content: item?.content || "" })
  }, [form, item?.content])

  const addOrUpdateProject = async () => {
    if (!item?.id) {
      message.error("Please select report item first")
      return
    }

    const values = await form.validateFields()
    await updateProjectReportItemContentApi({
      id: item.id,
      content: values.content || "",
    })
    message.success("更新成功")
    onSaved?.()

  }

  const insertMarkdownAtCursor = (markdown: string) => {
    const editor = editorRef.current
    if (!editor) {
      return
    }
    const selection = editor.getSelection()
    if (!selection) {
      return
    }
    editor.executeEdits("paste-image-upload", [
      {
        range: selection,
        text: markdown,
        forceMoveMarkers: true,
      },
    ])
    editor.focus()
  }

  const uploadImageAndInsert = async (file: File) => {
    if (isUploadingRef.current) {
      return
    }

    isUploadingRef.current = true
    setIsUploading(true)
    try {
      const resp = await uploadProjectReportImageApi(file)
      const url = resp.data?.url
      if (!url) {
        throw new Error("missing image url")
      }

      const alt = (file.name && file.name.trim()) || "image"
      insertMarkdownAtCursor(`![${alt}](${url})`)
      message.success("Image uploaded")
    } catch {
      message.error("Failed to upload image")
    } finally {
      isUploadingRef.current = false
      setIsUploading(false)
    }
  }

  const handleSelectUploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) {
      return
    }
    await uploadImageAndInsert(file)
  }

  const handleEditorMount = (editor: MonacoEditorNS.IStandaloneCodeEditor) => {
    editorRef.current = editor

    const handlePaste = async (event: ClipboardEvent) => {
      if (!editor.hasTextFocus()) {
        return
      }

      const items = event.clipboardData?.items
      if (!items || items.length === 0 || isUploadingRef.current) {
        return
      }

      const imageItem = Array.from(items).find(
        (item) => item.kind === "file" && item.type.startsWith("image/")
      )
      if (!imageItem) {
        return
      }

      const file = imageItem.getAsFile()
      if (!file) {
        return
      }

      event.preventDefault()
      await uploadImageAndInsert(file)
    }

    window.addEventListener("paste", handlePaste, true)
    editor.onDidDispose(() => {
      window.removeEventListener("paste", handlePaste, true)
    })
  }

  return <div>
    {/* {JSON.stringify(params)} */}
    <Flex gap={"small"} justify={"end"} style={{ margin:"0.5rem 0"}}>
      <Button icon={<UploadOutlined />} size="small" onClick={() => fileInputRef.current?.click()} loading={isUploading}>
        Upload Image
      </Button>
      <Button onClick={addOrUpdateProject} size="small" >Save</Button>
    </Flex>
    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      style={{ display: "none" }}
      onChange={handleSelectUploadImage}
    />
    <Form form={form}>

      <Form.Item name="content">
        {/* <TextArea rows={6} /> */}
        <MonacoEditor editorRef={editorRef} onEditorMount={handleEditorMount}></MonacoEditor>
      </Form.Item>
      {/* <Form.Item name="research">
        <TextArea rows={6} />
      </Form.Item> */}


      {/* <Form.Item label="样本分组名称" name="sample_group_name" >
                <Input />
            </Form.Item> */}

      <Collapse ghost items={[
        {
          key: "1",
          label: "More",
          children: <>
            <Form.Item noStyle shouldUpdate>
              {() => (
                <Typography>
                  <pre>{JSON.stringify({
                    id: item?.id,
                    project_report_id: item?.project_report_id,
                    owner_type: item?.owner_type,
                    owner_id: item?.owner_id,
                    sort_order: item?.sort_order,
                    content: form.getFieldValue("content"),
                  }, null, 2)}</pre>
                </Typography>
              )}
            </Form.Item>
          </>
        }
      ]} />
    </Form>

  </div>
}

export default AnalysisDocEditor;