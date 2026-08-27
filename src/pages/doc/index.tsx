import { FC, useEffect, useRef, useState } from "react"
import Markdown from "../../components/markdown"
import { Button, Tabs } from "antd"

// import Demo from "@/components/smart-table"
import { useNavigate } from "react-router"
const Project: FC<any> = () => {

    const navigate = useNavigate()

    // const containerRef = useRef<HTMLDivElement>(null);
    // const [top, setTop] = useState<any>(null);
    // const updateHeight = () => {
    //     if (containerRef.current) {
    //         const height = containerRef.current.getBoundingClientRect().top // 包含 padding
    //         setTop(height);

    //     }
    // }
    // useEffect(() => {
    //     updateHeight(); // 初始化
    //     window.addEventListener("resize", updateHeight);
    //     // window.addEventListener("scroll", updateHeight);
    //     return () => {
    //         window.removeEventListener("resize", updateHeight);
    //         //   window.removeEventListener("scroll", updateHeight);
    //     };
    // }, []);
    // console.log(top)
    return <div style={{}} >
        {/* <Tabs onChange={onChange} items={[
            {
                key:"english",
                label:"英文",
            },{
                key:"chinese",
                label:"中文",
            }
        ]}></Tabs> */}
        {/* <EmbedLLM content={"hi"}>LLM</EmbedLLM> */}
        {/* {top} */}
        <Button
            shape="circle"
            color="cyan"
            variant="solid"
            // icon={<PlusOutlined />}
            size="large"
            style={{
                position: "fixed",
                right: "3rem",
                top: "5rem",
                zIndex: 1000,
                boxShadow: "0 4px 10px rgba(0,0,0,0.2)",
            }}
            onClick={() => navigate("/")}
        >Back</Button>
        <div style={{ overflowY: "hidden", height: `calc(100vh)` }}>

            <iframe
                style={{
                    width: "100%",
                    height: "99.5%",// 减去顶部 header 或 margin
                    border: "none",
                }}
                title="BRAVE Docs"
                src="https://pybrave.github.io/brave-doc"></iframe>
        </div>

        {/* <Markdown data={data}></Markdown> */}
        {/* <Demo></Demo> */}
    </div>
}

export default Project