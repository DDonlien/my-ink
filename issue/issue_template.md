---
uid:
type: template
status: active
importance: p0
emergency: p0
updated-time: 2026-10-24T01:01:00
created-time: 2026-10-24T01:01:00
start-time: 2026-10-24T01:01:00
closed-time: 2026-10-24T01:01:00
created-version:
closed-version:
estimated-workhour:
actual-workhour:
commit-related:
tags:
---
# Description

每个 issue.md 文档正文中包含、且仅包含 Description 和 Comments 两个部分的一级标题

活动文件使用 `issue_任务描述.md`：按原语言连贯记录，中文不翻译，英文词用连字符；类型只记在属性中，文件名不带版本编号。`issue_template.md` 保持模板文件名。

功能性任务按当前工作副本的 [任务分类与追踪协作规则](../AGENTS.md#任务分类与追踪协作) 关联并维护最具体 Issue；项目明确配置外部 tracker 时，以稳定 UID / ID 和链接双向定位，恢复执行先吸收最新人工修正。事务性任务不因本条被强制新增 Issue，不默认启用外部表格或增加必填属性。

Description 内描述具体对象、要实现的行为、范围与当前阻塞，不使用空泛主题名代替任务描述。如果有必要可以用任何 md 原生支持的语法类型，但不被 myIssue 处理额外的分组，只是正确的作为 Description 内容渲染。

可以在行内添加图片，按照规范会保存到 issue/attachment 文件夹里

每一个 issue 文件本身需要有完整的、兼容 obisidian 的属性内容，去记录所有属性

我们预定义了一些属性条目，但自然的，像 obsidian 一样，这些内容可以添加；template 中使用的这些就是默认的属性

`uid` 是仓库内唯一的五位十进制字符串，保留前导零；同一 Git common repository 的分支和 worktree 共用命名域，旧 id 与已有扩展属性保留。

提交消息的 Summary 不放编号，Detail 正常描述；末尾空一行后统一使用单行 `Issues: issue-00001, issue-00007`，只有一个也写 `Issues: issue-00001`。相关 UID 去重，以逗号加空格分隔；同一 Issue 可关联多次提交，一次提交也可关联多个 Issue。Git 只解析 trailer 的键和值，UID 列表由本规范约定，不创建或移动原生 Git tag，也不是给 issue.md 文件加标签。

`commit-related` 以列表反向记录已存在的真实完整 Git commit hash / P4 changelist；记录提交自身的 hash 留待下一次实际更新补入，不为自引用无限追加提交。

旧文档中的 `recorded-version` 只作为兼容扩展保留已有内容发布版本数据，不再列为新版默认属性；它不是 Git / P4 编号。

# Comments

## YYYYMMDD-HHMMSS_Name_Model-Detail

> commit-no.

每一段具体的 comments 如果涉及一次 commit，则应该在开始位置以Obsidian引用格式记录commit-no.，支持git或perforce。commit No 也应该以列表形式记录到属性里

每一条 comment 在记录时用二级标题记录，标题固定为上述格式，其回复时间在标题里已经自然记录。

自然，如果是人类用户，则不存在 Model-Detail 的部分；

Name 在 AI 自行填写时记录实际执行 Agent，比如 Codex、DSH。Model-Detail 必须完整记录五个维度：厂牌-确切版本-规模/型号档位-推理级别-是否选择加速模式，例如 `GPT-6.1-SOL-MAX-FAST`。示例只是格式，不是本次真实参数；不能用 `GPT`、`GPT-6` 或模型系列名代替确切版本。加速字段只按可验证的选择记录为 `FAST` 或 `NONFAST`（未选择加速）；不可核实时写 `UNKNOWN`，不把响应速度、订阅档位、服务优先级当作加速选择。其他任一维度未知也必须写 `UNKNOWN` 并说明不可核实，不用当前设置猜填历史执行参数。人工 Comment 仍省略 Model-Detail。

对于 AI 来说，Comments 应该在每次任务执行完成后填写，填写时间 = 记录的时间。

对应执行涉及的 Git commit hash 或 P4 changelist 记录在该条 Comment 内容里；一条 issue 可以涉及多个 change，不限制为一个全局值。

和 Description 一样，如有必要，直接在行内添加图片。

对于涉及具体执行的 AGENT 对话的内容，应该在最后一行附上对应的 link，至少在对应版本的 myIssue 插件中，这个 link 应该点击后可以转跳到对应对话。这个 link 建议使用对应 agent 的标准格式，比如 ChatGPT desktop 就有内置的对话格式点击可以直接转跳到对话，其他 HARNESS 框架（如 DSH）也是同理。

每一段具体的 comments 最后应该用Obsidian引用格式记录深度链接(假设 chat 的影响会录入 issue，如果会，改链接即可)，形如：

> [对话内容](codex://threads/01a10755-9102-7291-8df2-539c0de8d4be)