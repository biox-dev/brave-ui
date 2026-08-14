import { useComponentStore } from '@/event-bus/stores/components';
import axios from 'axios';
import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router';

// 自定义 hook：分页逻辑
export const usePagination = ({ id, url, pageApi, params, map, initialPageSize = 10 }: any) => {
    const [data, setData] = useState<any[]>([]);  // 存储数据
    const [pageNumber, setPageNumber] = useState(1); // 当前页码
    const [totalPage, setTotalPage] = useState(0); // 总页数
    const [loading, setLoading] = useState(false); // 加载状态
    const [pageSize, setPageSize] = useState(initialPageSize); // 每页显示条数
    const [keywords, setKeywords] = useState<string>(""); // 搜索关键词
    const { register, unregister } = useComponentStore();
    const { state } = useLocation();
    console.log("usePagination state from location:", state);
    const [lastPage] = useState(state?.last || false); // 是否最后一页


    const search = useCallback((kw: string) => {
        setKeywords(kw);   // 更新关键词
        setPageNumber(1);  // 搜索时回到第一页
    }, []);
    // 模拟异步数据获取
    const fetchData = useCallback(async (page: number) => {
        setLoading(true);
        try {
            // 模拟 API 请求（这里用 setTimeout 来模拟延迟）
            //   const response = await new Promise<any>((resolve) => {
            //     setTimeout(() => {
            //       const totalItems = 50; // 假设总共 50 条数据
            //       const newData = Array.from({ length: pageSize }, (_, index) => ({
            //         id: (page - 1) * pageSize + index + 1,
            //         name: `Item ${(page - 1) * pageSize + index + 1}`,
            //       }));
            //       resolve({ data: newData, total: totalItems });
            //     }, 1000);
            //   });
            let response;
            if (url) {
                // const pageContainerApi = async (params: any) => {
                //     const resp: any = await axios.post(`/entity/page/${entityType}`, params)
                //     return resp
                // }
                response = await axios.post(url,
                    {
                        ...params,
                        page_number: page,
                        is_last: lastPage,
                        page_size: pageSize,
                        keywords: keywords || undefined, // 如果 keywords 有值才传
                    })
            } else {
                response = await pageApi({
                    ...params,
                    page_number: page,
                    page_size: pageSize,
                    is_last: lastPage,
                    keywords: keywords || undefined, // 如果 keywords 有值才传
                })
            }


            // "items": find_pipeline,
            // "total":total,
            // "page_number":query.page_number,
            // "page_size":query.page_size
            const { items, total, ...rest } = response.data

            if (map) {
                response.data = items.map(map)
                setData(response.data);
            } else {
                setData(response.data.items);
            }

            // 设置数据
            // setTotalPage(Math.ceil(response.total / pageSize)); // 计算总页数\
            setTotalPage(total || 0)
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }, [url, pageApi, JSON.stringify(params), pageSize, keywords, lastPage]);

    const reload = useCallback(() => {
        fetchData(pageNumber)
    }, [fetchData, pageNumber]);

    const loadLast = useCallback(() => {
        // totalPage 在当前实现中表示总记录数
        const lastPage = Math.max(1, Math.ceil((totalPage || 0) / pageSize));
        if (pageNumber !== lastPage) {
            setPageNumber(lastPage)
        } else {
            reload()
        }
    }, [totalPage, pageSize, pageNumber, reload]);

    useEffect(() => {
        // console.log("Registering pagination with id:", id);
        if (!id) return;
        register("tables", id, { reload, loadLast, search });
        return () => {
            unregister("tables", id);
        }
    }, [id]);

    // useEffect(() => {
    //     setPageNumber(1);
    // }, [url, JSON.stringify(params)]);
    useEffect(() => {
        fetchData(pageNumber); // 获取数据
    }, [fetchData, pageNumber]);

    return {
        data,
        pageNumber,
        totalPage,
        loading,
        setPageNumber, // 更新页码
        setPageSize,
        pageSize,
        reload,
        search
    };
};
