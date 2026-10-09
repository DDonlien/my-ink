# 墨线 NAS 部署

外网地址：[https://git.freshli4.com:10443/ink/](https://git.freshli4.com:10443/ink/)。该域名现有 HTTPS 入口使用 10443 端口。

应用目录为 NAS 上的 `/vol2/docker/ink-loom/`。`ink-loom-web` 使用已安装的 `caddy:2.10.2-alpine` 提供静态文件，加入现有 `gitea_default` 网络，不向宿主发布额外端口。它设置为自动重启，生产页面不依赖本机开发服务。

共享入口 `/vol2/docker/gitea/Caddyfile` 在 Git 站点内增加 `/ink/` 路由，其他请求继续交给 `server:3000`。修改前的配置备份在 `/vol2/docker/ink-loom/gateway-backups/`；部署保留原文件 inode，让已有单文件挂载能正常热加载。

## 构建与更新

1. 在应用根目录运行 `npm run build:public`，生成带 `/ink/` 资源前缀的生产文件。
2. 建立新的发布 ID，格式为 `YYYYMMDDTHHMMSSZ-` 加 10 位构建摘要。上传的暂存目录为 `/vol2/docker/ink-loom/staging/<发布ID>/`，内容为 `site/`（dist 中的文件）、本目录的 `Caddyfile` 和 `compose.yaml`。
3. 将 `install_nas.py` 上传到应用目录，再执行 `python3 /vol2/docker/ink-loom/install_nas.py <暂存目录> <发布ID>`。
4. 核对外网 HTML、JS、CSS、本地字体、favicon 和剧情图文件的 HTTP 状态、类型与摘要；再确认原 Git 首页仍可访问。`latest-release.json` 记录当前发布与构建文件摘要。

安装器先验证静态服务配置和容器健康，再验证共享入口的候选配置；共享配置变化时会中止覆盖。发布通过 `www/current` 原子切换目录，并保留上一版的哈希资源，方便已打开的页面继续加载。

已经存在的发布只在构建内容一致时允许重新激活，不覆盖旧构建。静态服务健康检查失败时恢复旧的目录指向；入口热加载失败时恢复旧入口配置。

## 回退

将 NAS 的 `www/current` 原子切换到 `www/releases/` 中需要恢复的版本。整个 `www` 父目录已挂载，切换后不需要重启共享入口；若静态服务配置也改变，使用 `configuration-backups/` 内的旧配置恢复并重新启动本应用容器。

如果需要撤下整个外网入口，恢复 `gateway-backups/` 中的对应 Caddyfile 并验证、热加载；若部署后其他服务也修改了入口配置，只撤下 `ink-loom:begin/end` 标记内的路由并恢复 Git 的原 fallback，保留其余变更。

## 已验证

- 公网 HTTPS 页面返回 200，正常验证证书；`/ink` 返回 308 到 `/ink/`。
- 构建文件均可访问，内容摘要与本地一致（文件清单见 latest-release.json），带摘要的脚本与样式使用 immutable 缓存，HTML 与本地字体需要重新核验。
- 容器 running / healthy，重启策略为 unless-stopped；本轮核对原 Git 首页 200，共享入口配置摘要与部署前一致。
- 现有 103 项剧情、状态语义、来源定位、条件修改、结构排布和隔离 DOM 自动测试通过。实际发布构建在本地浏览器中完成只读结果面板、合并与分解来源定位、结构化条件应用和恢复、872×853 与 390×844 布局检查，控制台无警告或错误。外网文件摘要、类型和正常 HTTPS 核验通过；外网自动浏览器复查再次超时。既有 Material Design 3 Expressive、拖拽与完整下载的验收范围见应用 README。
- 全站滚动条改动的 103 项回归测试与公网构建通过。本地发布构建的世界状态、节点面板、Markdown 编辑器、教程弹窗均完成真实滚动验收：闲置透明，滚动显示，停止后透明，区域宽度不变，控制台无警告或错误。证据保存在 artifacts/scrollbars-browser-validation.json。
- 对白框统一改动的 103 项回归测试与公网构建通过。本地发布构建的邻居段落中，有选项和无选项均为“对白”并共用 chat 图标与形状；合并模式仍为 5 框，分解模式仍为 14 框，顺序连接和末尾两条分支保留。浏览器证据见 artifacts/dialogue-boxes-browser-validation.json。
- 剧情图下拉箭头对齐改动的 103 项回归测试与公网构建通过。本地发布构建在 872×853 和 390×844 视口核对两个箭头的垂直中心偏差均为 0，右侧留白分别为 12px 和 8px，窄屏无横向溢出。点击箭头打开原生菜单与方向键选择均可正常切换段落，控制台无警告或错误；证据见 artifacts/dropdown-alignment-browser-validation.json。
- 顶部说明移除与版本标记排版的 103 项回归测试及公网构建通过。本地发布构建在 1280×720 和 390×844 视口无横向溢出，桌面文档工具栏缩短为 84px；版本前缀与数字间隔 2px、垂直中心偏差为 0，文档菜单正常打开，控制台无警告或错误。证据见 artifacts/toolbar-cleanup-browser-validation.json。
