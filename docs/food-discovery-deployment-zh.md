# FemFit 本次更新部署指南（中文版）

适用于现有 FemFit 项目的更新。你的项目已经采用 Supabase 数据库、Render 后端和 Vercel 前端，因此本次继续使用原来的三个项目，不需要新建。

本文根据 2026 年 9 月 20 日的本地代码与平台官方文档整理。平台菜单可能略有变化。文中的项目配置来自代码，尚未登录你的控制台核实。

目前新代码仍在本地。本文是操作说明，没有替你推送 GitHub、修改线上数据库或部署。

**先理解这四个地方：**

| 平台 | 在本项目中的作用 | 本次需要做什么 |
| --- | --- | --- |
| Supabase | 保存用户、经期、饮食和食物库数据 | 执行两个 SQL 文件 |
| GitHub | 保存代码版本 | 提交并推送本地改动 |
| Render | 运行后端，处理外部食物查询和 AI 请求 | 核对配置并部署新代码 |
| Vercel | 运行你打开的网页 | 核对配置并部署新代码 |

**操作顺序：先更新 Supabase，再检查平台配置，然后推送 GitHub，最后确认 Render 和 Vercel 都上线。**

推送可能同时触发两个平台的自动部署。前端如果先完成，而后端还在更新，外部食物查询可能暂时不可用。等两端部署的提交号一致后再验收。如果不能接受这个短暂窗口，需要另外安排受控发布，本文采用现有 Git 自动部署的简单流程。

**第 1 步：准备好网页和本地文件**

打开以下网站并登录你原来的账号：

- [Supabase 控制台](https://supabase.com/dashboard)
- [Render 控制台](https://dashboard.render.com/)
- [Vercel 控制台](https://vercel.com/dashboard)
- [FemFit GitHub 仓库](https://github.com/miaon1789/femfit)

打开 Mac 的“终端”，粘贴下面这行并按回车：

```bash
cd /Users/nimiao/femfit
```

后面的终端命令都在这个目录执行。命令框里的内容可以复制，不要复制说明文字。遇到报错先停在当前步骤，不要跳过错误继续发布。

本次会用到两个 SQL 文件：

- `/Users/nimiao/femfit/supabase/migrations/002_food_discovery.sql`
- `/Users/nimiao/femfit/supabase/seed/recipe_estimates.sql`

**不要运行旧的 `supabase/seed/food_database.sql` 或 `seed-foods.mjs` 来做本次升级。它们会先清空全局食物库。也不需要重跑整个 `schema.sql`。**

**第 2 步：在 Supabase 更新数据库结构**

1. 在 Supabase 控制台选择现有 FemFit 项目。
2. 打开左侧的 **SQL Editor**。
3. 新建一个查询，按钮可能叫 **New query** 或显示为 `+`。
4. 将 `002_food_discovery.sql` 的全部内容粘贴到编辑区。
5. 确认没有只选中其中几行，再点击 **Run**。

在 Mac 上，可以用下面的命令将整个文件复制到剪贴板，然后在网页按 `Command + V`：

```bash
pbcopy < /Users/nimiao/femfit/supabase/migrations/002_food_discovery.sql
```

这一步会新增食物来源字段，并建立 `search_foods` 搜索函数。脚本不包含删除饮食记录或清空食物库的语句。

**成功标志：**结果区域没有红色错误。对于这种修改结构的语句，显示类似 `Success. No rows returned` 是正常的，不代表没有执行。

再新建一个查询，运行以下检查：

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'user_foods'
  and column_name in ('source', 'source_url')
order by column_name;

select to_regprocedure('public.search_foods(text,integer)') as search_function;
```

第一个结果应包含 `source` 和 `source_url` 两个字段。第二个结果应显示函数名称，不能为 `NULL`。编辑器可能将两个结果放在不同结果页签。

如果报 `relation ... does not exist`，先检查是否选错了 Supabase 项目，不要通过新建空表来绕过错误。

Supabase 官方说明：[通过控制台管理数据库函数](https://supabase.com/docs/guides/database/functions)。

**第 3 步：加入 12 个参考配方**

在终端执行：

```bash
pbcopy < /Users/nimiao/femfit/supabase/seed/recipe_estimates.sql
```

回到 Supabase 的 SQL Editor，新建查询，粘贴并点击 **Run**。

这份脚本只添加尚不存在的同名配方，可以重复执行，不会清空原来的食物库。配方包括番茄鸡蛋面、鸡胸肉沙拉、虾仁炒饭等，营养值来自项目现有食材数据的组合估算。

执行后运行：

```sql
select name, serving_size, serving_unit, calories, serving_description
from public.food_database
where source = 'FemFit recipe estimate'
order by name;

select name, calories
from public.search_foods('西红柿鸡蛋面', 10);
```

**成功标志：**第一个查询应看到本次的 12 个配方。如果以后另加过相同来源的配方，可能多于 12 行。第二个查询应找到“番茄鸡蛋面（参考配方）”。

不要用全库总数必须等于 158 来判断是否成功，你的线上食物库可能与本地预置数据不同。

这些查询验证函数和数据。登录用户是否能正常搜索，还要在最后的网站验收中确认。

**第 4 步：核对 Render 后端配置**

在 Render 控制台打开现有后端服务。仓库配置里的服务名是 `femfit-backend`，实际控制台名称可能被修改过。

在 **Settings** 中核对：

| 设置 | 本项目需要的值 |
| --- | --- |
| Repository | `miaon1789/femfit` |
| Branch | `main` |
| Root Directory | `backend` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm run start` |
| Health Check Path | `/health` |
| Node 版本 | 仓库 Blueprint 配置为 `22` |

如果原来运行正常且配置一致，不需要重新填写。

在服务页面找到并记下后端网址，通常类似 `https://你的服务名.onrender.com`。以控制台实际显示的地址为准，不要照抄这个示例。

再打开 **Environment**，核对环境变量：

| Key | Value 应是什么 |
| --- | --- |
| `SUPABASE_URL` | 现有 Supabase 项目的 URL |
| `SUPABASE_ANON_KEY` | 现有项目的客户端公开密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | 现有后端使用的服务端密钥，只放在后端 |
| `FRONTEND_URL` | 你实际访问的前端正式网址，不带最后的 `/` |
| `AI_PROVIDER` | 保持原来的值，例如 `claude` |
| `CLAUDE_API_KEY` 或 `OPENAI_API_KEY` | 保持与你选择的 AI 服务一致的现有配置 |
| `USDA_API_KEY` | 下一步申请的 USDA 密钥，启用“基础食材”查询时填写 |

仓库 README 记录的前端地址是 `https://femfit-woad.vercel.app`。如果你现在使用其他正式域名，`FRONTEND_URL` 应填写那个地址。当前代码只允许一个来源域名。

现有密钥正常就保留，不要为了部署重新生成。密钥值直接在平台中填写，不要发到聊天里，也不要写进 GitHub。`backend/.env.example` 可以上传，因为其中只是变量示例。

如果增加或修改了变量，可以选择 **Save only**，稍后随新代码一起部署。如果界面没有这个选项，就按页面提供的保存方式操作，并在后面确认新版本部署成功。[Render 环境变量说明](https://render.com/docs/configure-environment-variables)

**第 5 步：开通 USDA 搜索，可选但建议完成**

1. 打开 [USDA FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide/)。
2. 点击页面里的 **Get an API Key**。
3. 按申请页面的要求填写信息，取得你自己的 API Key。
4. 回到 Render 后端的 **Environment**。
5. 添加 `USDA_API_KEY`，Value 填实际密钥。
6. 保存，确保后续新版本部署会使用它。

USDA 要求 API 请求携带密钥，不要把它公开到仓库。[USDA 官方接入说明](https://fdc.nal.usda.gov/api-guide/)

**这个密钥只放 Render 后端，不放 Vercel 的 `VITE_` 变量。**

如果暂时跳过这一步，食物库、收藏、最近记录和 Open Food Facts 条码查询仍可使用。“基础食材”入口会提示尚未开通。条码查询不需要申请 USDA 密钥。

**第 6 步：核对 Vercel 前端配置**

打开 Vercel 中现有的 FemFit 项目，不需要点击新建项目。

在 **Settings** 中找到构建和 Git 相关设置，核对：

| 设置 | 本项目需要的值 |
| --- | --- |
| Git Repository | `miaon1789/femfit` |
| Production Branch | `main` |
| Root Directory | `frontend` |
| Framework Preset | `Vite` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

部分值由 `frontend/vercel.json` 提供，控制台可能显示为自动检测或由文件覆盖。如果最终生效值相同，就不需要重复改动。[Vercel 构建配置说明](https://vercel.com/docs/builds/configure-a-build)

打开 **Settings → Environment Variables**，确认以下变量适用于 **Production**：

| Key | Value 应是什么 |
| --- | --- |
| `VITE_SUPABASE_URL` | 与后端相同的 Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | 该项目原来的客户端公开密钥 |
| `VITE_API_BASE_URL` | 第 4 步记下的 Render 后端网址 |

`VITE_API_BASE_URL` 不要填 `http://localhost:3000`。不要在后面加 `/api` 或 `/health`，代码会自己拼接接口路径，也不要加结尾的 `/`。

例如，实际后端地址如果是 `https://example-backend.onrender.com`，就只填写这段地址。

`VITE_` 变量会进入浏览器代码，因此这里不能放 `SUPABASE_SERVICE_ROLE_KEY`、USDA 密钥或 AI 密钥。

更改 Vercel 环境变量后，需要新建一次部署才会生效。单纯刷新旧网页不会更新这些变量。[Vercel 环境变量说明](https://vercel.com/docs/environment-variables)

**第 7 步：检查代码并上传 GitHub**

前面数据库和配置确认完成后，再回到终端。

先确认目录与分支：

```bash
cd /Users/nimiao/femfit
git branch --show-current
git status --short
```

分支应显示 `main`。如果不是，先停在这里，不要在有未提交改动时随意切换分支。

检查 GitHub 是否有这台电脑还没拿到的更新：

```bash
git fetch origin
git log --oneline HEAD..origin/main
```

第二行命令没有输出，表示远端没有领先于当前本地提交。如果有提交记录输出，说明需要先处理远端更新。不要使用 `git push --force` 覆盖。

运行测试和构建，每个命令成功后再执行下一个：

```bash
npm test --prefix frontend
npm test --prefix backend
npm run build --prefix frontend
git diff --check
```

后端的 `npm test` 已包含后端构建。本次开发时验证通过了 49 项前端测试和 8 项后端测试。如果之后改过代码，测试数量可能变化。

如果提示找不到依赖或 `vitest`，先分别运行 `npm ci --prefix frontend` 和 `npm ci --prefix backend`，再重试。`git diff --check` 成功时通常没有输出。

下面的命令只加入本次代码和文档，排除了两个 LinkedIn 素材文件。整块复制即可，行尾的反斜杠表示命令还没有结束：

```bash
git add \
  .github/workflows/ci.yml \
  backend/.env.example \
  backend/package.json \
  backend/src/index.ts \
  backend/src/lib/externalFoods.ts \
  backend/src/routes/foods.ts \
  backend/tests/externalFoods.test.mjs \
  backend/tests/foodsRoute.test.mjs \
  frontend/src/components/food/AddFoodSheet.tsx \
  frontend/src/components/food/FoodPicker.tsx \
  frontend/src/components/food/FoodTab.tsx \
  frontend/src/components/onboarding/OnboardingFlow.tsx \
  frontend/src/components/period/PeriodInput.tsx \
  frontend/src/components/period/PeriodInput.test.ts \
  frontend/src/components/ui/Input.tsx \
  frontend/src/hooks/useCalorieTarget.ts \
  frontend/src/hooks/useCalorieTarget.test.ts \
  frontend/src/hooks/useFoodLibrary.ts \
  frontend/src/hooks/useFoodLogs.ts \
  frontend/src/hooks/useFoodLogs.test.ts \
  frontend/src/hooks/usePeriodLogs.ts \
  frontend/src/hooks/usePeriodLogs.test.ts \
  frontend/src/i18n/locales/en.json \
  frontend/src/i18n/locales/zh.json \
  frontend/src/lib/api.ts \
  frontend/src/lib/foodSearch.ts \
  frontend/src/lib/foodSearch.test.ts \
  frontend/src/lib/foodPortions.ts \
  frontend/src/lib/foodPortions.test.ts \
  supabase/migrations/002_food_discovery.sql \
  supabase/seed/gen-recipe-sql.mjs \
  supabase/seed/recipe_estimates.json \
  supabase/seed/recipe_estimates.sql \
  docs/food-discovery-deployment.md \
  docs/food-discovery-deployment-zh.md
```

检查准备提交的文件：

```bash
git diff --cached --stat
git diff --cached --name-only
```

确认没有真实 `.env` 文件。`backend/.env.example` 是正常的。如果之前还暂存过其他文件，它们也会出现在这里，需要先确认是否属于本次提交。

为减少第一次手动发布的操作，下面将这次已经一起验证过的改动打包为一个提交：

```bash
git commit -m "Fix cycle calorie updates and improve food discovery"
git push -u origin main
git rev-parse --short HEAD
```

记下最后显示的短提交号，后面用它确认两个平台部署的是同一份代码。

**成功标志：**刷新 GitHub 仓库，能看到刚才的提交标题、新增的 `FoodPicker.tsx` 和数据库迁移文件。到仓库 **Actions** 页面查看同一次提交的 CI，前端和后端检查应通过。

如果报 `Permission denied (publickey)`，是 GitHub SSH 登录配置问题。如果报 `non-fast-forward`，是远端有新提交。两种情况都先停下，把不含密钥的错误文字发给我，不要强制推送。

**第 8 步：确认 Render 后端上线**

回到 Render 后端服务，检查是否已经开始自动部署。

- 已经开始：等待本次部署完成。
- 没有开始：打开 **Manual Deploy → Deploy latest commit**。

确认这次部署使用的提交号与第 7 步相同。不要只点击 **Restart service**，重启已有服务不等于部署 GitHub 的最新代码。[Render 部署说明](https://render.com/docs/deploys)

**成功标志：**本次部署成功，服务正常运行。若失败，查看对应部署的日志，重点找第一条实际错误，而不是最后一行“部署失败”。

在浏览器打开“你的真实后端网址”后面加 `/health` 的地址。例如后端是 `https://example-backend.onrender.com`，就访问 `https://example-backend.onrender.com/health`。

应看到类似：

```json
{"status":"ok","service":"femfit-backend","ts":"..."}
```

这说明后端进程可以访问，但还不能证明 USDA 密钥和用户登录都正常。完整检查在第 10 步进行。

**第 9 步：确认 Vercel 前端上线**

进入 Vercel 项目的 **Deployments**：

1. 找到第 7 步对应提交号的新部署。
2. 确认它是 **Production** 部署。
3. 等待状态变成 **Ready**。
4. 打开原来的正式网址。

Vercel 连接 Git 仓库后，可以在生产分支更新时自动创建生产部署。[Vercel Git 部署说明](https://vercel.com/docs/git)

如果 GitHub 已有新提交，但 Vercel 没有新部署，先核对 Git 仓库连接和 Production Branch。需要手动创建时，使用控制台从最新 `main` 提交创建部署的入口。**不要对旧提交点 Redeploy 并以为它会自动变成新代码。**

如果你是在新版本已经构建后才修改 Vercel 环境变量，需要对该新提交再部署一次。

页面还是旧版时，在 Mac 浏览器按 `Command + Shift + R`。如果你使用的是安装到手机桌面的 PWA，先彻底关闭再打开，也可以先用普通浏览器访问正式网址作对照。不要为了刷新页面先清空数据库或删除账户。

**第 10 步：登录网站，逐项验收**

建议用专门的测试账号。下面的保存操作会创建真实记录，不要在自己的健康记录里随意添加虚构经期。

| 检查项 | 怎么操作 | 应看到什么 |
| --- | --- | --- |
| 新界面 | 饮食记录 → 添加食物 | 最近吃过、我的收藏、食物库、包装条码、基础食材 |
| 食物搜索 | 在食物库输入“西红柿鸡蛋面” | 找到“番茄鸡蛋面（参考配方）” |
| 克数换算 | 选每 100 g 为 116 kcal 的米饭，改为 150 g | 174 kcal |
| 碗数换算 | 改成 1 碗 | 没填写每碗克数前，保存会提示补充换算 |
| 明确份量 | 填每碗 150 g | 仍为 174 kcal |
| 收藏 | 点击“保存为常用食物”，关闭后重新打开 | 我的收藏中能找到并重新选用 |
| 最近记录 | 在测试账号保存一条食物，再重新打开添加面板 | 最近吃过中能看到它 |
| 复制餐食 | 在较早日期记录午餐，再切到较晚日期点击午餐的“复制上一次同餐次” | 整餐添加一次，数量与营养值相同 |
| 条码查询 | 输入食品包装上的真实条码并搜索 | 查到时显示来源和营养值，库中没有时显示无结果 |
| USDA | 在“基础食材”用英文搜索 `chicken breast` | 配置好密钥后显示 USDA 结果，区分生熟描述 |
| 周期修复 | 在测试账号记录新经期，回首页 | 周期起点更新，目标按新阶段重新计算 |

不是每个包装条码都一定有数据。出现“没有结果”不能单独证明接口坏了，可以换一个产品对照。当前条码功能是手动输入，尚未加入摄像头扫码。

周期热量也不一定每次都改变。例如当前代码中经期和黄体期的周期调整量都为 75 kcal，因此这两个阶段之间切换时，周期这一项可能不变。

**遇到问题时，对照这里排查**

| 现象 | 优先检查 |
| --- | --- |
| 食物库一直“查询失败” | `002_food_discovery.sql` 是否在正确项目执行，`search_foods` 函数是否存在，当前账号是否登录 |
| 收藏加载或保存失败 | `user_foods` 是否新增了 `source` 和 `source_url`，用户是否登录 |
| 只有 USDA 提示尚未开通 | Render 是否有 `USDA_API_KEY`，保存后是否部署过 |
| 条码和 USDA 都失败 | Render 是否部署了新提交，Vercel 的 `VITE_API_BASE_URL` 是否正确 |
| 浏览器报 CORS 错误 | Render 的 `FRONTEND_URL` 是否与浏览器地址栏的来源一致，包括 `https` 和域名，不含路径或末尾斜杠 |
| 后端接口返回 401 | 先在 FemFit 登录，必要时退出后重登。这些搜索接口需要登录令牌，不能直接在地址栏当成公开网页测试 |
| 返回 429 | 查询过于频繁或上游额度受限，暂停后再试，不要连续点击搜索 |
| 数据库提示 schema cache 找不到新函数 | 先确认函数确实已创建。若存在但 API 仍看不到，可在 SQL Editor 执行下方刷新命令，再重试 |
| 页面仍是旧版 | 检查 Vercel 提交号、正式域名和浏览器/PWA 缓存 |
| `/health` 返回正常但搜索失败 | 健康检查只验证进程，继续检查登录、变量和外部服务响应 |

仅在已经确认函数存在、但 API 缓存还没有刷新时执行：

```sql
notify pgrst, 'reload schema';
```

操作依据：[Supabase 刷新 API 数据库结构缓存说明](https://supabase.com/docs/guides/troubleshooting/refresh-postgrest-schema)。

如果上线后出现明显故障，先在两个平台的部署历史中找到上一版成功部署，确认提交号后恢复代码版本。新增数据库字段通常可以保留，不要通过删表来回退。回退可能影响自动部署设置，因此再次发布前要核对平台设置。

发给我排查信息时，提供当前步骤、平台名称、提交号和错误文字就够了。截图请遮住 API Key、令牌和个人健康记录。

**这次发布完成的标志：**Supabase 检查通过，GitHub 有新提交且 CI 通过，Render 与 Vercel 部署同一个新提交，并且登录后的食物搜索、份量换算、保存与复制能正常使用。USDA 如果暂未配置，应明确记为尚未启用。
