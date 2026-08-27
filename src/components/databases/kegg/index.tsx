import React, { FC, forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Card, Col, Drawer, Empty, Flex, Form, Input, Row, Select, Spin, Tag, Tooltip } from "antd";
import { useForm } from "antd/es/form/Form";
import { RedoOutlined } from '@ant-design/icons'
import { useModal } from "@/hooks/useModal";
// import EntityViewPanel from "@/pages/entity";
import { useOutletContext } from "react-router";
import { useSelector } from "react-redux";
interface Entry {
  id: string;
  name: string;
  type: string;
  link: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

const KGMLMap: FC<any> = ({ pathwayId, organisms, ...rest }) => {
  const [image, setImage] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState<boolean>(false)

  const loadKgml = async (pathwayId: any) => {
    setLoading(true)
    const res = await axios.get(`/kegg/kgml/${pathwayId}`)
    setImage(res.data.image);
    setEntries(res.data.entries);
    setLoading(false)
  }
  useEffect(() => {
    if (pathwayId && organisms) {
      loadKgml(`${organisms}${pathwayId}`)
    }

  }, [pathwayId, organisms]);

  return (
    <Card
      size="small"
      extra={<>
        <Tooltip title="refresh">
          <RedoOutlined onClick={() => loadKgml(`${organisms}${pathwayId}`)} />
        </Tooltip>
      </>}
      title={`${organisms}${pathwayId}`} loading={loading}>
      {/* {JSON.stringify(entries)} */}
      <div style={{ position: "relative", textAlign: "center" }}>
        {image && (
          <>
            <img
              src={image}
              alt="KEGG pathway"
              useMap="#kgmlmap"
              style={{ border: "1px solid #ddd", maxWidth: "100%" }}
            />
            <map name="kgmlmap">
              {entries.map((e) => {
                const left = e.x - e.width / 2;
                const top = e.y - e.height / 2;
                const right = e.x + e.width / 2;
                const bottom = e.y + e.height / 2;
                return (
                  <area
                    key={e.id}
                    shape="rect"
                    coords={`${left},${top},${right},${bottom}`}
                    href={e.link}
                    target="_blank"
                    alt={e.label}
                    title={e.label}
                  />
                );
              })}
            </map>
          </>
        )}
      </div>
    </Card>

  );
}

const KGMLMap2: FC<any> = ({ pathwayId, organisms }) => {
  const [image, setImage] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightKeys, setHighlightKeys] = useState<string[]>([]);

  const loadKgml = async (pathwayId: string) => {
    setLoading(true);
    const res = await axios.get(`/kegg/kgml/${pathwayId}`);
    setImage(res.data.image);
    setEntries(res.data.entries);
    setLoading(false);
  };

  useEffect(() => {
    if (pathwayId && organisms) {
      loadKgml(`${organisms}${pathwayId}`);
    }
  }, [pathwayId, organisms]);

  return (
    <Card
      size="small"
      extra={
        <>
          <Tooltip title="刷新">
            <RedoOutlined onClick={() => loadKgml(`${organisms}${pathwayId}`)} />
          </Tooltip>
          <Input
            placeholder="输入要高亮的基因/化合物ID，用逗号分隔"
            style={{ width: 250, marginLeft: 10 }}
            onChange={(e) => setHighlightKeys(e.target.value.split(","))}
          />
        </>
      }
      title={`${organisms}${pathwayId}`}
      loading={loading}
    >
      <div style={{ position: "relative", textAlign: "center" }}>
        {image && (
          <>
            <img
              src={image}
              alt="KEGG pathway"
              style={{ border: "1px solid #ddd", maxWidth: "100%" }}
            />
            {entries.map((e) => {
              const left = e.x - e.width / 2;
              const top = e.y - e.height / 2;
              const isHighlight = highlightKeys.includes(e.id) || highlightKeys.includes(e.name);

              return (
                <a
                  key={e.id}
                  href={e.link}
                  target="_blank"
                  style={{
                    position: "absolute",
                    left,
                    top,
                    width: e.width,
                    height: e.height,
                    background: "red",
                    border: isHighlight ? "2px solid red" : "1px solid transparent",
                    borderRadius: 4,
                    boxSizing: "border-box",
                    pointerEvents: "auto",
                    animation: isHighlight ? "flash 1s infinite alternate" : "none",
                  }}
                >
                  <Tooltip title={e.label}>
                    <div style={{ width: "100%", height: "100%" }} />
                  </Tooltip>
                </a>
              );
            })}
          </>
        )}
      </div>

      <style>
        {`
          @keyframes flash {
            0% { opacity: 1; box-shadow: 0 0 5px red; }
            50% { opacity: 0.5; box-shadow: 0 0 15px yellow; }
            100% { opacity: 1; box-shadow: 0 0 5px red; }
          }
        `}
      </style>
    </Card>
  );
};


interface Entry {
  id: string;
  name: string;
  type: string;
  link: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}
const { Search } = Input

export const KGMLMapSVG = forwardRef<any, any>(({ pathwayId, highlightKeys = [], compound, KOList }, ref) => {
  const [image, setImage] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(false);
  const { messageApi } = useOutletContext<any>()
  const { baseURL } = useSelector((state: any) => state.user)
  const [currentHighlightEntries, setCurrentHighlightEntries] = useState<Entry[]>([]);

  useImperativeHandle(ref, () => ({
    reload: reload
  }))

  const loadKgml = async (pathwayId: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`/kegg/kgml/${pathwayId}`);
      setImage(res.data.image);
      setEntries(res.data.entries);
    } catch (error) {
      // messageApi.error("数据获取失败!")
    }

    setLoading(false);
  };

  const reload = () => {
    if (pathwayId ) {
      loadKgml(`${pathwayId}`);
    }
  }
  useEffect(() => {
    reload()
  }, [pathwayId]);

  // 缩放比例
  const scaleX = imgRef.current ? imgRef.current.width / imgSize.width : 1;
  const scaleY = imgRef.current ? imgRef.current.height / imgSize.height : 1;
  const checkContains = (label: any, name: any) => {

    const isMatch = highlightKeys.some((item: any) =>
      label
        .split(",")
        .map((v: any) => v.trim().toLowerCase())
        .includes(item.trim().toLowerCase()) ||
      name
        .split(" ")
        .map((v: any) => v.trim().toLowerCase())
        .includes(item.trim().toLowerCase())
    );


    return isMatch
  }

  const highlightEntries = useMemo(() => {
    if (!compound || (compound && compound.length == 0)) return entries;
    const directionMap = new Map(Object.entries(compound));

    // return entries.map((item: any) => {
    //   if (checkContains(item.label, item.name)) {
    //     return {
    //       isHighlight: true,
    //       ...item
    //     }
    //   } else {
    //     return {
    //       ...item
    //     }
    //   }
    // });
    const highlightEntries = entries.map((item: any) => {
      // item.name.map((it:any)=> directionMap.get(item.name))
      let direction: any = null;

      for (const it of item.name) {
        direction = directionMap.get(it)
        if (direction) {
          break
        }
        // if(it=="C00146"){
        //   console.log(it,"--",direction)
        // }

      }
      // if(item.name.includes("C00146")){
      //   console.log("--",direction)
      // }
      if (direction) {
        if (item.type == "ortholog") {
          return {
            isHighlight: true,
            color: direction > 0 ? "#ff0084ff" : "#0011feff",
            direction: direction,
            ...item
          }
        } else {
          return {
            isHighlight: true,
            color: direction > 0 ? "#ff4d4f" : "#1890ff",
            direction: direction,
            ...item
          }
        }

      } else {
        return {
          ...item
        }
      }
    });
    const currentHighlightEntries = highlightEntries.filter((item: any) => item.isHighlight)
    setCurrentHighlightEntries(currentHighlightEntries)
    return highlightEntries
  }, [entries, compound]);
  const expand = 3
  // console.log(highlightEntries)
  // console.log(highlightEntries.filter((item: any) => item.isHighlight))
  return (


    <Spin spinning={loading}>
      
      {/* {JSON.stringify(currentHighlightEntries)} */}
      {currentHighlightEntries && currentHighlightEntries.map((item: any, index: any) => (
        <Tag key={index}
          style={{ cursor: "pointer", marginBottom: 4 }}
          onClick={() => window.open(item.link, "_blank")}
          color={item.color} >{item.name.join(", ")} {item.direction > 0 ? "(Upregulated)" : "(Downregulated)"}</Tag>
      ))}
      {currentHighlightEntries && currentHighlightEntries.length > 0 && <>{currentHighlightEntries.length}</>}
      <hr />
      {KOList && KOList.length > 0 && KOList.map((item: any, index: any) => (<Tag key={index} color={"geekblue"}>{item}</Tag>))}
      {KOList && KOList.length > 0 && <>{KOList.length}</>}
      <Flex justify="center" vertical>
        {/* {JSON.stringify(currentHighlightEntries)} */}

        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 24,
            alignItems: "center",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >

          {/* 基因图例 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: "#ff0084ff", // 红色代表上调
                border: "1px solid #999",
                borderRadius: 2,
              }}
            />
            <span>Gene (Upregulated)</span>
          </div>


          {/* 基因图例 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: "#0011feff", // 红色代表上调
                border: "1px solid #999",
                borderRadius: 2,
              }}
            />
            <span>Gene (Downregulated)</span>
          </div>

          {/* 基因图例 */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: "#ff4d4f", // 红色代表上调
                border: "1px solid #999",
                borderRadius: 2,
              }}
            />
            <span>compound (Upregulated)</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: "#1890ff", // 蓝色代表下调
                border: "1px solid #999",
                borderRadius: 2,
              }}
            />
            <span>compound (Downregulated)</span>
          </div>

          {/* 若你区分类型：基因 vs 代谢物 */}
          {/* <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                display: "inline-block",
                width: 14,
                height: 14,
                background: "#52c41a", // 绿色
                border: "1px solid #999",
                borderRadius: 2,
              }}
            />
            <span>代谢物 (Metabolite)</span>
          </div> */}
        </div>
        <Flex justify="center" >
          <div style={{ position: "relative", display: "inline-block" }}>
            {image && (
              <>
                <img
                  ref={imgRef}
                  src={`${baseURL}${image}`}
                  alt="KEGG pathway"
                  style={{ maxWidth: "100%", height: "auto" }}
                  onLoad={(e) => {
                    const target = e.currentTarget;
                    setImgSize({ width: target.naturalWidth, height: target.naturalHeight });
                  }}
                />
                {/* SVG Overlay */}
                <svg
                  width={imgSize.width}
                  height={imgSize.height}
                  style={{ position: "absolute", top: 0, left: 0, }}
                >
                  {highlightEntries.map((e) => {
                    // const isHighlight = checkContains(e.label)// highlightKeys.includes(e.label) || highlightKeys.includes(e.name);
                    return (
                      <a
                        key={e.id}
                        href={e.link}
                        target="_blank"
                      >
                        <rect
                          x={(e.x - e.width / 2 - expand) * scaleX}
                          y={(e.y - e.height / 2 - expand) * scaleY}
                          width={(e.width + expand * 2) * scaleX}
                          height={(e.height + expand * 2) * scaleY}
                          fill={e.isHighlight ? e.color : "transparent"}
                          stroke={e.isHighlight ? e.color : "transparent"}
                          strokeWidth={2}
                          rx={4}
                          ry={4}
                        >
                          {e.isHighlight && (
                            <animate
                              attributeName="opacity"
                              values="1;0.3;1"
                              dur="0.5s"
                              repeatCount="indefinite"
                            />
                          )}
                        </rect>

                        <title>{e.name.join(", ")} {e.direction ? `(${e.direction})` : ""}</title>
                      </a>
                    );
                  })}
                </svg>
              </>
            )}
          </div>
        </Flex>
      </Flex>
    </Spin>
  );
})

const KGMLMapSVGCard: FC<any> = (rest) => {
  const [highlightKeys, setHighlightKeys] = useState<string[]>([]);
  const { organisms, pathwayId } = rest
  const kGMLMapSVGRef = useRef<any>(null)
  return <Card
    size="small"
    extra={
      <>
        <Tooltip title="刷新">
          <RedoOutlined onClick={() => kGMLMapSVGRef.current.reload()} />
        </Tooltip>
        <Search
          placeholder="输入要高亮的基因/化合物ID，用逗号分隔"
          style={{ width: 250, marginLeft: 10 }}
          allowClear
          onSearch={(val) => setHighlightKeys(val.split(","))}
        />
      </>
    }
    title={`${organisms}${pathwayId}`}
  >
    
    <KGMLMapSVG ref={kGMLMapSVGRef} {...rest} highlightKeys={highlightKeys} ></KGMLMapSVG>
  </Card>
}
const Kegg: FC<any> = () => {
  const [pathwayId, setPathwayId] = useState<string>()
  const [form] = useForm()
  const [values, setValues] = useState<any>()
  // const formId = Form.useWatch((values: any) => values?.analysis_id, form);
  const onValuesChange = (changedValues: any, allValues: any) => {
    console.log(changedValues)
    console.log(allValues)
    setValues(allValues)
  }
  return <>

    <Row>
      <Col lg={6} sm={6} xs={24} style={{ paddingRight: "1rem" }}>
        <Card
          size="small"
        >
          <Form form={form} onValuesChange={onValuesChange}>
            <Form.Item name={"organisms"} label={"organisms"}
              rules={[{ required: true, message: '该字段不能为空!' }]}
              tooltip={<>
                KEGG Organisms:<a target="_blank" href="https://www.genome.jp/kegg/tables/br08606.html">br08606</a>
              </>}

            >
              <Select allowClear options={[
                {
                  label: "hsa",
                  value: "hsa"
                }, {
                  label: "mmu",
                  value: "mmu"
                }, {
                  label: "rno",
                  value: "rno"
                }
              ]}></Select>
            </Form.Item>
            <Form.Item
              rules={[{ required: true, message: '该字段不能为空!' }]}
              name={"pathwayId"} label={"Pathway Id"}>
              <SelectEntity></SelectEntity>
              {/* <Select allowClear options={[
                {
                  label: "00564",
                  value: "00564"
                }, {
                  label: "04144",
                  value: "04144"
                }, {
                  label: "04927",
                  value: "04927"
                }
              ]}></Select> */}
            </Form.Item>
          </Form>
        </Card>
      </Col>
      <Col lg={18} sm={18} xs={24} >

                

        {(values?.organisms && values?.pathwayId) ? <KGMLMapSVGCard  {...values}></KGMLMapSVGCard> :
          <Card>   <Empty></Empty></Card>
        }

      </Col>

    </Row>

  </>
}


const SelectEntity: FC<any> = ({ value, onChange }) => {
  const { modal, openModal, closeModal } = useModal();
  // const form = Form.useFormInstance();

  return <>
    <Input value={value} onClick={() => { openModal("entityDrawer", { name: "pathwayId" }) }}></Input>
    <EntityDrawer
      // callback={loadData}
      visible={modal.key == "entityDrawer" && modal.visible}
      params={modal.params}
      onClose={closeModal}
      onChange={onChange}
    ></EntityDrawer>
  </>
}
const EntityDrawer: FC<any> = ({ visible, setRecord, onChange, params, onClose, callback }) => {

  return <>
    <Drawer open={visible} onClose={onClose} width={"80%"}>
      {/* {visible &&
        <EntityViewPanel tabKey={"mesh-KEGG"}
          params={{
            category: ["KEGG"]
          }}
          disableWidth={true} rowSelection={{
            onChange: (selectedRowKeys: any, selectedRows: any) => {
              // console.log(form,selectedRows, params.name)
              onChange(selectedRows[0].entity_id.replaceAll("map", ""))
              // setRecord({...selectedRows[0],fieldName:})
              onClose()
            }, type: "radio"

          }}></EntityViewPanel>
      } */}


    </Drawer>
  </>

}
export default Kegg