# CareFinder

印度医疗设施搜索应用。地图使用真实道路和地名，医院坐标、服务依据和三种名次由排名接口提供。

## 先运行

解压 ZIP，进入能看到 app.py 和 app.yaml 的目录，运行 `python3 app.py`，在浏览器打开 `http://localhost:8000`。本地演示使用 Python 标准库。默认从 Jaipur 搜索 30 km 内的透析服务，返回两条明确标记为 Demo 的虚构记录。全国地名和街道底图来自地图数据源。正式医院数据通过你们的排名服务接入。

同版本的单文件 CareFinder_Preview.html 可直接下载，用 Chrome 打开。它内置地图资源，可以演示交互和导出纠错草稿。运行 Python 版可验证实际提交和回执。

## 地图和结果

- 点地图设置起点，或者在 Starting point 搜索城市、城镇、别名或输入经纬度。拖动地图只移动视野；停下后可点 Search this area 搜索视野中心。
- 触控板捏合、滚轮和触屏双指都能缩放。Show search area 显示完整半径圆。圆代表直线距离。
- 点击任何榜单的医院会定位并标红。Street detail 放大到周边街道。View evidence 显示服务原文、记录 ID、来源、位置依据和不确定性。
- Balanced、Nearest、Best Match 分别使用 fused_rank、distance_rank、relevance_rank。正式模式沿用后端名次。坐标缺失的医院保留在可用榜单内。半径、服务、起点变更时，旧请求不能覆盖新结果。
- 离线地图包含 7,232 个印度城镇地点，以及全国概览地理数据。Jaipur、Delhi、Mumbai、Lucknow、Patna 的部分区域有较详细的街道，Bengaluru、Kolkata、Hyderabad、Chennai、Pune、Ahmedabad 的部分区域有城市级道路。其余街道按视野在线加载，名称和详细程度受 OpenStreetMap 覆盖影响。医院点位始终取自排名返回的坐标。

## 在 Databricks Apps 部署

1. 进入 **care-finder-cmu 所在的 workspace**。你之前的两张截图中，源码页地址以 dbc-55279c5b 开头，App 页以 dbc-fbba90f6 开头。选择后者上传源码，或在已有源码的 workspace 创建 App。
2. 在该 workspace 的 **Workspace → Users → 自己的目录** 创建 CareFinder_JS。解压 ZIP，将项目文件全部放入这个目录。打开后应直接看到 app.yaml、app.py、index.html、streets-data.js 等文件。
3. 在 App 页点 **Deploy**，用文件夹按钮选中刚上传的 CareFinder_JS，再点 **Select → Deploy**。启动命令已在 app.yaml 配好。部署成功后从 Overview 打开应用。
4. 正式展示前，通过下面的环境变量配置排名和纠错收件端，再部署一次。在没有配置持久收件端的 Databricks App 中，Report 可生成草稿。

官方说明：[部署应用](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/deploy) · [应用环境配置](https://docs.databricks.com/aws/en/dev-tools/databricks-apps/app-runtime)

## 排名接口

浏览器调用同源 POST /api/rank。服务端可转发到 RANK_API_URL（可选 RANK_API_TOKEN），或导入 CARE_RANK_MODULE 指定模块中的 search(payload)。

```json
{"service_id":"dialysis","origin":{"latitude":26.9124,"longitude":75.7873,"label":"Selected point in Jaipur"},"radius_km":30}
```

队友返回原有的 service_id、radius_km、distance_method 和 results 数组。每个结果保留 facility_id、facility_name、latitude、longitude、address、location_basis、distance_km、distance_rank、relevance_rank、fused_rank、relevance_reason、evidence、record_source_urls、uncertainties。evidence 包含 field、quote 和 record_id。可选 fusion_method 用于解释综合排序。服务菜单保留原有六项。

## Report 与 Admin 对接

顶部 Report 可选择地图/搜索体验或医院。医院详情中的 Report 自动带入 facility_id 和 service_id。用户可选填证据 record_id、来源链接。任何修改先进入待审队列。管理员的接受、驳回和更新正式数据由你们的管理端处理。

浏览器向 POST /api/reports 发送 application/json 和 Idempotency-Key 请求头（UUID v4）。同一份草稿重试使用同一编号。示例正文：

```json
{"facility_id":"demo_a","service_id":"dialysis","record_id":"demo_record_a","issue_type":"location","suggested_change":"Please verify the facility pin against the address in the record.","source_url":null}
```

issue_type 可取 service、location、facility_details、evidence、other。通用反馈可用 location 或 other，facility_id 和 record_id 为 null。后端生成 report_id、data_mode 和 status。成功响应为 HTTP 202，正文含 report_id 和 status（pending）。

按以下顺序选择收件方式：

1. **团队 Admin 后端**。设 REPORT_API_URL 为接收 POST 的接口，按需设置 REPORT_API_TOKEN。CareFinder 转发上述字段、report_id、data_mode、status 和相同的 Idempotency-Key。接收端应按编号去重、记录到达时间，在成功存储后返回 JSON，例如 `{"report_id":"与请求完全相同的 UUID","status":"pending"}`。接口失败时用户可保留草稿重试。
2. **Databricks 持久收件箱**。给 App 的 service principal 提供目标 Unity Catalog volume 的 USE CATALOG、USE SCHEMA、READ VOLUME、WRITE VOLUME。设 REPORTS_VOLUME 为 /Volumes/catalog/schema/volume 或 catalog.schema.volume。每条报告作为独立 JSON 保存在该 volume 的 carefinder-inbox 目录，含 received_at。管理端可以读取这个目录。应用通过 Databricks SDK 调用 Files API。
3. **本地运行**。默认 SQLite 收件箱位于 ~/.local/state/carefinder/reports.sqlite3，可用 REPORT_DB_PATH 覆盖。查看待审数据：`SELECT * FROM facility_reports WHERE status = 'pending';`

app.yaml 示例（地址须换成团队的实际接口）：

```yaml
command: ["python", "app.py"]
env:
  - name: RANK_API_URL
    value: "https://your-team.example/rank"
  - name: REPORT_API_URL
    value: "https://your-team.example/reports"
```

使用 volume 时，将上例 REPORT_API_URL 一项换成 REPORTS_VOLUME 和实际 volume 路径。需要 token 时通过 Databricks secret resource 的 valueFrom 引用，避免写进前端。

地图数据的来源和许可证见 GEOGRAPHY-SOURCES.txt、STREETS-SOURCES.txt 和 Leaflet-LICENSE.txt。

## 按地点推荐服务

配置 SERVICE_SUGGESTIONS_API_URL 指向团队的热门服务接口，按需设置 SERVICE_SUGGESTIONS_API_TOKEN。网页初始化和用户确认新起点时会调用 POST /api/service-suggestions。服务或半径单独变化时不调用。代理将以下 JSON POST 到配置的团队接口。

```json
{"location":{"latitude":26.9124,"longitude":75.7873,"label":"Selected point in Jaipur"}}
```

团队后端按该区域的搜索频率降序，返回 HTTP 200 和一个 service ID 数组。无统计数据时返回 []。

```json
["dialysis","mri","emergency_c_section","nicu","cardiac_surgery"]
```

同一个服务下拉框先显示 Most searched in your area（最多五个有效且不重复的 ID，保留返回顺序），再显示 Other services · A–Z（其余菜单项按英文名排序）。用户原先选中的服务会保留。空列表、接口失败或超时均显示完整字母表。单文件预览和未配置接口的演示版提供 Jaipur、Mumbai 两组虚构示例，并在分组标题显示 Demo。正式搜索模式仅使用配置的热门服务接口。

## 管理员页面进度

本包提供 Report 表单、接收接口和持久收件箱。管理员登录、待审列表、接受和驳回界面由团队的 Admin Portal 接入。
