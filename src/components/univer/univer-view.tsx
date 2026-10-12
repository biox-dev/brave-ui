

import { FC, useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Flex, Space, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import sheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import type { IWorkbookData } from '@univerjs/presets'
import { useNavigate, useParams } from 'react-router'
import {
  readSheetWorkbookByFileIDApi,
  writeSheetWorkbookByFileIDApi,
} from '@/api/sheet'
import { getFileApi } from '@/api/data'

import './styles.css'

import '@univerjs/preset-sheets-core/lib/index.css'
import { useSelector } from 'react-redux'
import { useGlobalMessage } from '@/hooks/useGlobalMessage.ts'

export interface UniverViewProps {
  /** go_file 的业务主键（int64 雪花 ID 的字符串形式）。 */
  file_id?: string
}

/** 本组件展示所需的文件元信息子集。 */
type FileMeta = {
  file_name?: string
  format?: string
  path?: string
}

/** Univer 仅支持表格格式，其余由后端返回“页面不支持预览”。 */
const UNSUPPORTED_PREVIEW_MESSAGE = '页面不支持预览'

const extractErrorMessage = (error: any): string => {
  const data = error?.response?.data
  const candidates = [data?.error?.message, data?.message, data?.detail, error?.message]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }
  }
  return UNSUPPORTED_PREVIEW_MESSAGE
}

const UniverView: FC<UniverViewProps> = ({ file_id }) => {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const univerAPIRef = useRef<ReturnType<typeof createUniver>['univerAPI'] | null>(null)
  const workbookSeqRef = useRef(0)
  const [fileId, setFileId] = useState('')
  const [fileMeta, setFileMeta] = useState<FileMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const { theme } = useSelector((state: any) => state.user);
  const message = useGlobalMessage()

  const routeID = String(params?.id ?? '').trim()
  // 作为路由页面（/dataset-file/:id）渲染时 URL 携带 go_file 主键 id，需要先解析出
  // 业务 file_id；作为抽屉渲染时由 file_id 属性直接传入。
  const isRouteView = !file_id && routeID !== ''
  const showEditor = previewError === null

  const replaceWorkbook = useCallback((workbookData: Partial<IWorkbookData>) => {
    const univerAPI = univerAPIRef.current
    if (!univerAPI) {
      return
    }

    const activeWorkbook = univerAPI.getActiveWorkbook()
    if (activeWorkbook) {
      activeWorkbook.dispose()
    }

    workbookSeqRef.current += 1
    const baseId = String(workbookData.id ?? 'workbook')
    const uniqueWorkbookData: Partial<IWorkbookData> = {
      ...workbookData,
      id: `${baseId}-${Date.now()}-${workbookSeqRef.current}`,
    }

    univerAPI.createWorkbook(uniqueWorkbookData)
  }, [])

  // 解析 file_id：优先使用属性传入，其次由 URL 中的主键 id 查询文件获得。
  useEffect(() => {
    let cancelled = false

    const resolveFileID = async () => {
      // 切换目标文件时，先把上一个文件的状态彻底重置（预览错误 / 元信息 / 已解析的
      // file_id）。否则旧文件的 previewError 会让 showEditor 一直为 false，导致下方的
      // 加载 effect 提前 return，新文件的工作簿永远不会加载，页面停在“页面不支持预览”。
      // 同时清空 fileId，避免在异步解析出新 id 之前误加载旧文件、再次触发该错误。
      setPreviewError(null)
      setFileMeta(null)
      setFileId('')

      const propFileID = String(file_id ?? '').trim()
      if (propFileID) {
        setFileId(propFileID)
        return
      }
      if (!routeID) {
        return
      }

      setLoading(true)
      try {
        const resp = await getFileApi(routeID)
        if (cancelled) {
          return
        }
        setFileMeta({
          file_name: resp.data.file_name,
          format: resp.data.format,
          path: resp.data.path,
        })
        setFileId(resp.data.file_id)
      } catch (error) {
        if (cancelled) {
          return
        }
        console.error(error)
        setPreviewError(extractErrorMessage(error))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void resolveFileID()

    return () => {
      cancelled = true
    }
  }, [file_id, routeID])

  const loadWorkbook = useCallback(async (targetFileID: string) => {
    const univerAPI = univerAPIRef.current
    if (!univerAPI) {
      return
    }

    const resolvedFileID = String(targetFileID ?? '').trim()
    if (!resolvedFileID) {
      message.warning('缺少 file id')
      return
    }

    setLoading(true)
    try {
      // 不传 format，由后端按文件路径后缀推断。
      const resp = await readSheetWorkbookByFileIDApi({ file_id: resolvedFileID })
      setPreviewError(null)
      if (resp.data.file) {
        setFileMeta({
          file_name: resp.data.file.file_name,
          format: resp.data.file.format,
          path: resp.data.file.path,
        })
      }
      replaceWorkbook(resp.data.workbook_data as Partial<IWorkbookData>)
    } catch (error) {
      console.error(error)
      // 不支持的格式后端会返回“页面不支持预览”，这里直接展示后端消息。
      setPreviewError(extractErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [message, replaceWorkbook])

  const saveWorkbookToFile = useCallback(async () => {
    const univerAPI = univerAPIRef.current
    if (!univerAPI) {
      return
    }

    const activeWorkbook = univerAPI.getActiveWorkbook()
    if (!activeWorkbook) {
      message.warning('当前没有可保存的工作簿')
      return
    }

    const resolvedFileID = String(fileId ?? '').trim()
    if (!resolvedFileID) {
      message.warning('缺少 file id')
      return
    }

    setLoading(true)
    try {
      const workbookData = activeWorkbook.save()
      await writeSheetWorkbookByFileIDApi({
        file_id: resolvedFileID,
        workbook_data: workbookData as unknown as Record<string, unknown>,
      })

      message.success('保存成功')
    } catch (error) {
      console.error(error)
      message.error(extractErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [fileId, message])

  const handleReload = useCallback(() => {
    setPreviewError(null)
    setReloadToken((token) => token + 1)
  }, [])

  // 仅在编辑器需要挂载/卸载时创建、销毁 Univer；切换文件只替换工作簿数据。
  useEffect(() => {
    if (!showEditor || !containerRef.current) {
      return
    }

    const { univer, univerAPI } = createUniver({
      locale: LocaleType.ZH_CN,
      darkMode: theme === 'dark',
      locales: {
        [LocaleType.ZH_CN]: mergeLocales(sheetsCoreZhCN),
      },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
        }),
      ],
    })

    univerAPIRef.current = univerAPI

    return () => {
      univerAPIRef.current = null
      univer.dispose()
    }
    // 主题切换由下方单独的 effect 处理，避免切换主题时重建实例。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEditor])

  useEffect(() => {
    if (!showEditor || !fileId) {
      return
    }

    void loadWorkbook(fileId)
  }, [fileId, showEditor, loadWorkbook, reloadToken])

  useEffect(() => {
    univerAPIRef.current?.toggleDarkMode(theme === 'dark')
  }, [theme])

  return (
    <div className="univer-view">
      <div className="univer-view__toolbar">
        <Flex justify="space-between" align="center" gap={8}>
          <Space size={8} align="center">
            {isRouteView ? (
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
            ) : null}
            <Typography.Text strong ellipsis style={{ maxWidth: 480 }}>
              {fileMeta?.file_name || fileId || 'Sheet'}
            </Typography.Text>
            {fileMeta?.format ? <Tag color="cyan">{fileMeta.format}</Tag> : null}
          </Space>
          <Space size={8}>
            {isRouteView && fileId ? (
              <Button icon={<ReloadOutlined />} loading={loading} onClick={handleReload}>
                刷新
              </Button>
            ) : null}
            <Button
              type="primary"
              loading={loading}
              disabled={!fileId || !!previewError}
              onClick={() => void saveWorkbookToFile()}
            >
              保存
            </Button>
          </Space>
        </Flex>
      </div>
      {previewError ? (
        <Alert
          type="warning"
          showIcon
          message={previewError}
          description={fileMeta?.path}
        />
      ) : (
        <div className="univer-view__container" ref={containerRef} />
      )}
    </div>
  )
}

export default UniverView