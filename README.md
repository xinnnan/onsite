# 现场通 OnSite

面向现场工程师、安装人员、合作伙伴和临时工的双语签到、签退与项目报告 Web App。

- 正式域名：`https://onsite.supportportal.ai`
- 默认语言：简体中文，可切换 English
- 技术栈：Next.js 16 App Router、TypeScript、Supabase、Sharp、ExcelJS、React PDF、Vercel
- 产品边界：不获取 GPS、不调用地图 API、不做人脸识别

## 已实现范围

- Username + Password 登录；用户名仅在服务端转换为内部 Auth Email
- Worker 仅查看已分配的 Active Projects，单项目自动选择，多项目手动选择
- 前置摄像头自拍、预览、重拍、签到与签退
- 服务器正式时间、原图与水印图私有存储、SHA-256 照片哈希
- 水印包含人员、项目、客户、地址、项目时区时间、记录编号和管理员上传的项目地图
- 原子 Check In / Check Out 数据库事务、单一 Open Session、自动工时与 18 小时 Long Session
- Admin 人员、项目、地图、分配、考勤、手工修正和审计管理
- Customer / Project / Worker / Company / Date / Status 考勤筛选
- CSV、XLSX 和带可选照片附录的 PDF 客户报告
- 历史项目字段与地图版本快照；项目后续编辑不会改变旧记录
- RLS、角色页面保护、Private Storage 和临时 Signed URLs

完整验收矩阵见 [`docs/prd-status.md`](docs/prd-status.md)。

## 本地运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。开发环境没有配置 Supabase 时会进入不持久化的演示模式：`admin` 开头的用户名进入 Admin，其余用户名进入 Worker。生产环境缺少 Supabase 配置时会关闭演示模式并返回配置错误。

## 环境变量

```text
NEXT_PUBLIC_APP_URL=https://onsite.supportportal.ai
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-key>
INTERNAL_AUTH_EMAIL_DOMAIN=field.internal
ONSITE_DEMO_MODE=false
```

新式 Publishable / Secret Key 为首选。代码仍兼容旧的 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY`。Secret/Service Role Key 只能放在 Vercel Server Environment Variables，绝不能使用 `NEXT_PUBLIC_` 前缀。

## Supabase

项目已经采用 CLI migrations：

```bash
supabase link --project-ref opjibbtimhnnanlhsaak
supabase migration list --linked
supabase db push --linked
```

迁移会创建数据库表、索引、RLS、私有 Storage Buckets、更新时间触发器以及原子签到/签退 RPC。

Supabase Dashboard → Authentication → URL Configuration 应保持：

```text
Site URL
https://onsite.supportportal.ai

Redirect URLs
https://onsite.supportportal.ai
https://onsite.supportportal.ai/auth/update-password
http://localhost:3000/auth/update-password
```

这可防止密码恢复链接回到 `localhost:3000`。产品内的管理员重置密码功能直接调用 Supabase Admin API，不发送邮件。

### 首个管理员

全新环境需要先在 Supabase Authentication 中创建并确认一个内部用户，例如 `admin@field.internal`，再使用该 Auth User UUID 创建 Profile：

```sql
insert into public.profiles (
  auth_user_id, username, display_name, company, worker_type, role, status
) values (
  '<auth-user-uuid>', 'admin', 'Administrator', 'Example Robotics',
  'EMPLOYEE', 'ADMIN', 'ACTIVE'
);
```

密码只保存在 Supabase Auth，业务数据库不保存密码或明文密码。

## Vercel

1. 将 GitHub 仓库导入 Vercel。
2. 在 Production / Preview / Development 中按需配置环境变量；Production 必须保持 `ONSITE_DEMO_MODE=false`。
3. 将 `onsite.supportportal.ai` 绑定为项目域名。
4. 推送 `main` 后检查 Deployment Build、登录、Worker 签到/签退和 Admin 报告下载。

`next.config.ts` 已配置 HTTPS HSTS、frame、MIME、referrer 和浏览器权限策略；相机仅允许当前站点，GPS 与麦克风被禁用。

## 验证命令

```bash
npm run lint
npm run build
npm audit --omit=dev
```

PDF 照片附录为控制 Serverless 内存最多包含筛选结果前 60 个 Work Sessions；CSV/XLSX 仍导出完整筛选结果（上限由 Supabase API 的 1000 行配置控制）。

## 安全与数据规则

- Worker 不能提交 `user_id`、正式时间、项目名称、客户或地址。
- 正式时间由服务器生成并以 UTC 保存；项目时区用于水印展示。
- 每名 Worker 同时最多一个 `OPEN` Work Session，应用校验和数据库部分唯一索引双重保证。
- 地图使用不可变版本路径；事件保存完整项目快照。
- 原图、水印图和项目地图均在 Private Buckets；Admin 通过 10 分钟 Signed URL 查看。
- Admin 修正 Work Session 必须填写 Reason，旧值、新值和操作人写入 Audit Log。
