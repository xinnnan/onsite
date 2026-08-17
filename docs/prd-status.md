# PRD v1.2 实现状态

更新时间：2026-08-17

## 总结

PRD 的 33 项 MVP 验收标准均已实现并发布。远端 Supabase 已应用 `202608170001` 与 `202608170002` 两个迁移，Auth Site URL 已设置为正式域名；GitHub `main` 与 Vercel Production 均已更新并验证。

## MVP 验收矩阵

| 验收项 | 状态 | 实现依据 |
| --- | --- | --- |
| Username + Password 登录 | 完成 | `/api/auth/login` 将用户名转换为内部 Email 后调用 Supabase Auth |
| 不需要邮箱和手机号 | 完成 | 登录页只显示 Username / Password；内部 Email 不展示 |
| Admin 创建账号 | 完成 | Admin Users UI + Supabase Admin Auth API + Profile 回滚保护 |
| Admin 重置密码 | 完成 | 管理员直接设置新密码，不依赖邮件链接 |
| Admin 停用账号 | 完成 | Profile `DISABLED` 后所有页面/API 鉴权拒绝访问 |
| Admin 创建项目 | 完成 | Project CRUD 包含 PRD 全字段 |
| Admin 维护项目地址 | 完成 | Address 1/2、City、State、Postal Code、Country、Timezone |
| Admin 上传地图截图 | 完成 | JPEG/PNG/WEBP 转换为最大 1200px WEBP，保存至 Private Storage |
| Admin 替换地图截图 | 完成 | 新地图使用不可变版本路径并更新 Project Master Data |
| Worker 只见已分配项目 | 完成 | Assignment 查询 + RLS + Active Project 过滤 |
| 单项目自动选择 | 完成 | 只有一个项目时自动选择；多个项目必须手动选择 |
| 实时自拍签到 | 完成 | `getUserMedia` 前置摄像头、Preview、Retake、Submit Check In |
| 实时自拍签退 | 完成 | Open Session 自动确定项目并提交 Check Out 自拍 |
| 不请求 GPS | 完成 | 无 Geolocation API；Permissions-Policy 禁用 geolocation |
| 不调用地图 API | 完成 | 地图仅由 Admin 手工上传 |
| 正式时间来自服务器 | 完成 | API Server 生成时间；客户端时间只写 `client_capture_time` |
| 水印读取 Project Master Data | 完成 | Server 在提交时查询 Profile、Project 与 Assignment |
| 水印使用上传地图 | 完成 | Sharp 下载 Private Project Asset 后合成 |
| 水印包含 Worker / Project / Address / Time | 完成 | 另含客户、事件类型和 Record ID |
| 自动形成 Work Session | 完成 | Security Definer RPC 原子创建/关闭 Session |
| 每人只有一个 Open Session | 完成 | 服务端校验 + 部分唯一索引 |
| 自动计算工时 | 完成 | 数据库按服务器时间计算秒数；超过 18 小时标记 Long Session |
| 按 Project 查询 | 完成 | Admin Attendance Project Select |
| 按日期查询 | 完成 | Start Date / End Date 范围筛选 |
| 按 Worker 查询 | 完成 | Admin Attendance Worker Select |
| Admin 查看自拍 | 完成 | 只返回 Watermarked Private Asset 的短期 Signed URL |
| 导出 Excel / CSV | 完成 | ExcelJS 双工作表与 UTF-8 CSV，包含照片记录引用 |
| 生成 PDF | 完成 | Header、地图、Summary、Personnel、Daily Attendance、可选照片 |
| Attendance 保存 Project Snapshot | 完成 | 每个 Event 写入名称、客户、现场、地址、时区和地图路径快照 |
| 项目修改不影响历史 | 完成 | 导出/详情优先读取 Event Snapshot；地图使用不可变版本路径 |
| Attendance 修正必须填写 Reason | 完成 | 前后端强制 Reason，并校验时间顺序与状态 |
| 所有管理员修改进入 Audit Log | 完成 | User、Password、Project、Map、Assignment、Session 均记录旧值/新值 |
| 所有照片使用 Private Storage | 完成 | 三个 Bucket 均 `public=false`；只由服务端访问 |

## 超出验收项但已完成

- 中英双语切换，默认中文并跨页面保存语言偏好。
- Admin/Worker 页面级角色保护和 API 级重复鉴权。
- 图片旋转、压缩、WEBP 转换、SHA-256、失败上传清理。
- Dashboard 实时统计和最近七日真实工时。
- 正式环境缺失 Supabase 配置时 fail closed，不允许演示账号登录。
- `/auth/update-password` 支持正确域名的 Supabase Recovery 回调。
- 响应式桌面/手机界面、Lint、TypeScript Production Build 和依赖审计。

## 发布与运营检查

- [x] Supabase 项目链接正确：`opjibbtimhnnanlhsaak`
- [x] 数据库迁移 `202608170001` 已应用
- [x] 数据库迁移 `202608170002` 已应用
- [x] Supabase Site URL 为 `https://onsite.supportportal.ai`
- [x] Recovery Redirect allow-list 包含正式回调地址
- [x] 本地 `npm run lint` 通过
- [x] 本地 `npm run build` 通过
- [x] `npm audit --omit=dev` 为 0 vulnerabilities
- [x] 浏览器桌面与 390px 手机断点验收通过
- [x] 将本次代码提交推送到 GitHub `main`
- [x] Vercel Production Deployment 成功，正式域名与安全响应头已核对
- [ ] 使用真实 Worker 手机完成一次 Check In + Check Out
- [ ] 使用真实 Admin 下载一份带照片 PDF 并核对客户内容
