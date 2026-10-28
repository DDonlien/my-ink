---
uid: '00001'
type: DOC
status: in-progress
importance: p0
emergency: p0
updated-time: '2026-10-28T05:55:10.779188+00:00'
created-time: '2026-10-28T05:55:10.779188+00:00'
start-time: '2026-10-28T05:55:10.779188+00:00'
closed-time: null
created-version: null
closed-version: null
estimated-workhour: null
actual-workhour: null
commit-related: []
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

## 当前范围与状态

- [ ] 适配本工作副本的相关规则和模板并完成轻量文本检查。
- [ ] 仅提交本任务文件，向经核实的既有目标分支普通推送，并读取远端结果。

本记录不表示其他分支、合并现场、第三方或生成内容已完成。未执行 GUI、引擎、业务构建或视觉验收。

# Comments

## 20261028-055510_Codex

按用户最新明确授权准备本仓库的规范刷新。此时尚未生成本轮实施提交，commit-related 为空；不以当前 HEAD 或文档历史冒充业务提交。实际模型详情未提供，不补造。

> [本次规范刷新需求与执行对话](codex://threads/01a172bc-a59e-74ad-9553-ff4370c9a0f0)
