# 现场通 OnSite

面向现场工程师、安装人员、合作伙伴和临时工的签到、签退与项目报告 Web App。

- 计划域名：`https://onsite.supportportal.ai`
- 默认语言：简体中文，可随时切换 English
- 技术栈：Next.js App Router、TypeScript、Tailwind CSS、Supabase、Vercel
- 产品边界：不获取 GPS、不使用地图 API、不做人脸识别

## 当前版本

仓库包含完整的可交互界面原型和 Supabase 数据层骨架：

- Username + Password 登录（用户名在服务端转换成内部虚拟邮箱）
- Worker 项目选择、工作中状态、自拍相机、签到/签退成功页
- Admin 概览、人员、项目、分配、考勤详情、报告、审计日志
- 中英双语切换（默认中文，语言偏好仅保存为设备 UI 偏好）
- Supabase PostgreSQL 表、索引、RLS 与私有 Storage Bucket 迁移
- Vercel 安全响应头与正式域名环境变量模板

未配置 Supabase 环境变量时，应用会自动进入界面演示模式：任意用户名和非空密码均可登录；用户名以 `admin` 开头进入 Admin，其余用户名进入 Worker。演示模式不保存业务数据。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。

## Supabase 初始化

1. 创建 Supabase 项目。
2. 在 SQL Editor 运行 `supabase/migrations/202608170001_initial_schema.sql`。
3. 将 Project URL 和 anon key 填入 `.env.local`。
4. 仅在 Vercel Server Environment Variables 中设置 `SUPABASE_SERVICE_ROLE_KEY`，绝不能使用 `NEXT_PUBLIC_` 前缀。
5. Admin 创建用户时，以 `<username>@field.internal` 作为 Supabase Auth 内部邮箱；该邮箱不展示、不验证、不发信。

## Vercel 与域名

1. 将本仓库导入 Vercel。
2. 配置 `.env.example` 中的变量。
3. 在 Vercel 项目 Domains 中添加 `onsite.supportportal.ai`。
4. 按 Vercel 给出的记录在 `supportportal.ai` 的 DNS 提供商处添加 CNAME/A 记录。

域名的最终绑定需要在 Vercel 和 DNS 控制台完成，仓库内已将正式 URL 作为 metadata 与环境变量默认值。

## 关键安全约束

- 正式时间只使用服务器时间；`client_capture_time` 仅用于异常分析。
- Worker 只能读取自己的 Profile、项目分配、当前 Work Session 和 Attendance。
- 每名 Worker 同时最多一个 `OPEN` Work Session（数据库部分唯一索引保证）。
- 历史 Attendance Event 保存完整项目快照，后续项目修改不影响历史。
- 项目地图只由 Admin 上传，明确不代表人员实际 GPS 位置。
- 管理员修正必须填写 Reason 并写入 Audit Log。
- 原图、水印图和项目地图均保存在私有 Bucket，通过 Signed URL 查看。

## 发布前待办

- 补齐 Admin 创建/重置 Supabase Auth 用户的 service-role API。
- 实现签到/签退事务、Sharp 水印合成与照片哈希。
- 用 ExcelJS 与 `@react-pdf/renderer` 替换当前演示导出。
- 添加端到端测试、异常重试和正式审计写入。
