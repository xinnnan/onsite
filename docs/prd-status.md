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

## 2026-10 增量功能

- **报告中心 · 全部项目**：项目下拉新增“全部项目”，可按人员 + 期间导出跨项目报告。预览、PDF、Excel 显示“涉及项目”汇总（客户、项目、现场、时区、天数、工时），每日考勤增加项目列，时间仍按各项目当地时区；PDF 文件名为 `All-Projects_<期间>_<人员>.pdf`。
- **考勤记录 · 工时表**：`/admin/attendance/timesheet` 新标签页。选择人员和任意日期范围，按天列出（空白日期显示空行，多班次显示多行），像 Excel 一样输入签到/签退（支持 `8`、`830`、`5:30pm`、从 Excel 粘贴、次日 +1、批量填充工作日）。新行通过管理员补录接口创建为人工核实记录，已有记录通过修正接口保存为 `MANUALLY_CORRECTED`；统一填写原因写入审计日志，失败行保留草稿和错误提示。
- 纯逻辑位于 `lib/report-projects.ts` 与 `lib/timesheet.ts`，由 `npm run test:unit`（Node 内置测试）覆盖。
- **公司经理角色（MANAGER）**：Admin 在人员管理中把角色设为 MANAGER 并填写公司。经理只读访问概览、人员、考勤记录/详情和报告中心，数据限定为本公司 `ACTIVE` 的 Worker；其他公司、已停用人员、项目管理、项目分配、工时表和审计日志均不可见，所有写操作仍只允许 Admin。范围逻辑见 `lib/access-scope.ts`（单元测试覆盖），查询过滤见 `lib/admin-data.ts`。迁移 `202610150001_manager_role.sql` 新增角色并要求经理必须填写公司。
- **经理管理本公司项目与分配**：项目新增「所属公司」（迁移 `202610160001_project_company.sql`）。经理可在项目管理中新建（自动归属本公司）、编辑、上传地图和归档本公司项目，并在项目分配中为本公司在职人员分配或移除本公司的进行中项目；共享项目（未设所属公司）和其他公司的项目对经理不可编辑，经理的操作以其本人记入审计日志。Admin 在项目表单中设置所属公司，可从已有公司名称中选择。同时修复项目部分更新时 `country`/`status` 被默认值覆盖的问题。
- **经理成为本公司管理员**：经理的项目 = 本公司人员（在职）被分配过的项目 ∪ 所属公司为本公司的项目，可查看、编辑、上传地图并分配本公司人员，项目无需设置所属公司（「所属公司」改为 Admin 可选项，经理不可见）。经理可为本公司新建 Worker 账号（公司和角色固定），编辑姓名与人员类型、重置密码，但不能修改角色、公司或停用账号。经理可补录、修正本公司人员的考勤并使用工时表；永久删除考勤和审计日志仍只限 Admin。迁移 `202610170001_manager_manual_attendance.sql` 让补录 RPC 接受本公司经理。
- **经理现场打卡**：经理和 Worker 一样在 `/worker` 自拍签到/签退（管理后台侧边栏「现场打卡」，打卡页「管理中心」返回）。经理可在项目分配中把自己分配到本公司项目。经理的考勤出现在考勤记录、概览和报告（含 PDF、Excel、CSV）中，人员筛选包含本公司经理；同公司经理之间可以查看彼此的考勤，但经理考勤（包括本人）的补录和修正只由 Admin 完成。迁移 `202610180001_manager_clock_in.sql` 让签到、签退 RPC 接受经理，并允许 Admin 为经理补录。

## 发布与运营检查

- [x] Supabase 项目链接正确：`opjibbtimhnnanlhsaak`
- [x] 数据库迁移 `202608170001` 已应用
- [x] 数据库迁移 `202608170002` 已应用
- [x] 数据库迁移 `202610150001`（公司经理角色）已应用
- [x] 数据库迁移 `202610160001`（项目所属公司）已应用
- [x] 数据库迁移 `202610170001`（经理补录考勤）已应用
- [ ] 数据库迁移 `202610180001`（经理现场打卡）已应用
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
