---
uid: '00001'
type: DOC
status: done
importance: p0
emergency: p0
updated-time: '2026-10-28T07:10:55.910137+00:00'
created-time: '2026-10-28T05:55:10.779188+00:00'
start-time: '2026-10-28T05:55:10.779188+00:00'
closed-time: '2026-10-28T06:09:40.838160+00:00'
created-version: null
closed-version: null
estimated-workhour: null
actual-workhour: null
commit-related:
- 0337a31f69e2026259b738a40469a23c409a5c77
- 94a6520dad679cd493569f8e0b0e54fd3e0a1072
tags:
- agent-template
- collaboration
---
# Description

在本仓库的现有工作副本适配用户确认的分支命名、Issue 属性与提交关联规范；保持项目自定义规则和历史任务数据。

- 只有用户明确授权 Agent 创建分支时才使用 `user-name/target-branch-name[/usage-name]`，既有分支不改名。
- UID 为仓库内唯一五位十进制字符串，同一 Git common repository 的分支与 worktree 共用命名域；保留旧 id、parent、completed-time 等真实数据。
- 提交末尾使用单行 `Issues: issue-00001, issue-00007`，不创建或移动原生 Git tag；commit-related 反向记录实际完整 hash。
- 更新模板默认字段和 Comment 首尾引用，未知时间、版本、工时留空；原语言 Issue 命名、附件、历史与内容更新检查保持。

- AI Comment 的 Model-Detail 记录厂牌、确切版本、规模/型号档位、推理级别与加速选择五维；不可核实项用 UNKNOWN，不用系列名或响应速度猜填。

## 当前范围与状态

- [x] 适配本工作副本的相关规则和模板并完成轻量文本检查。
- [x] 仅提交本任务规范与模板文件。
- [x] 规范实现提交已向既有目标分支普通推送，并读回远端 SHA。

本条执行记录随后单独提交；其提交与推送结果见本次外部适配报告，不以此前实现提交的远端结果冒充记录提交结果。

本记录不表示其他分支、合并现场、第三方或生成内容已完成。未执行 GUI、引擎、业务构建或视觉验收。

# Comments

## 20261028-055510_Codex_UNKNOWN-UNKNOWN-UNKNOWN-UNKNOWN-UNKNOWN

按用户最新明确授权准备本仓库的规范刷新。此时尚未生成本轮实施提交，commit-related 为空；不以当前 HEAD 或文档历史冒充业务提交。实际模型详情未提供，不补造。

> [本次规范刷新需求与执行对话](codex://threads/01a172bc-a59e-74ad-9553-ff4370c9a0f0)

## 20261028-060940_Codex_UNKNOWN-UNKNOWN-UNKNOWN-UNKNOWN-UNKNOWN

> 0337a31f69e2026259b738a40469a23c409a5c77

上列为同一仓库本轮实际生成的规范实现提交；多 worktree 以同一 UID 记录此适配任务，不以业务任务的完成状态代替文档更新。受影响规则、模板 YAML、两个一级标题、提交尾部 Issues 行、文件范围及保留并行改动检查通过。本工作副本的实现提交已普通推送并读回预期 SHA。本记录提交自身的 hash 留待下一次实际 Issue 更新补入，不为自引用追加提交链。CI 状态单列在适配报告，未把未运行检查说成通过；未做 GUI、引擎或业务构建验收。执行环境未提供完整模型标识，未补造。

> [本次规范刷新需求与执行对话](codex://threads/01a172bc-a59e-74ad-9553-ff4370c9a0f0)

## 20261028-071055_Codex_GPT-UNKNOWN-UNKNOWN-UNKNOWN-UNKNOWN

> 94a6520dad679cd493569f8e0b0e54fd3e0a1072

落实用户对 AI Comment 模型详情的五维要求：厂牌、确切版本、规模/型号档位、推理级别、用户是否选择加速。当前系统只可核实 Codex / GPT 家族；运行环境没有提供确切模型版本、型号档位、推理级别或用户加速选择，四项均为 UNKNOWN，不根据响应速度或服务优先级猜测。历史执行参数无法重新核实，因此本轮既有缺项标题仅补全 UNKNOWN 五维，原时间、Agent、正文、来源与记录事实保留。

原缺项标题：`20261028-055510_Codex`, `20261028-060940_Codex`。

仅修正规范、模板说明与本次适配记录，保留人工 Comment 规则。上列记录更新前已存在的实际提交；本提交自身 SHA 留待下一次实际 Issue 更新，不为自引用额外追加提交。只做文档、YAML、标题与 diff 检查，未做业务构建或视觉验收。

> [本次规范修订需求与执行对话](codex://threads/01a172bc-a59e-74ad-9553-ff4370c9a0f0)
