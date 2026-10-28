---
uid: '00002'
type: DOC
status: done
importance: p0
emergency: p0
updated-time: '2026-10-28T08:20:48.571000+00:00'
created-time: '2026-10-28T08:20:48.571000+00:00'
start-time: '2026-10-28T08:20:48.571000+00:00'
closed-time: null
created-version: null
closed-version: null
estimated-workhour: null
actual-workhour: null
commit-related: []
tags:
- agent-template
- tracking-policy
---
# Description

定义并采用功能性 / 事务性任务分类、Issue 自动匹配与项目既有外部追踪协作规范，改变协作模板使用者可感知的任务执行和追踪行为；作为独立规范维护需求记录，不将它硬塞进已完成的分支命名任务。

- [x] 以最终用户可直接或间接感知结果为唯一分类界限，功能性必须关联 Issue，事务性遵循项目原有记录要求。
- [x] 明确自动复用、修改、独立任务 / 子任务判断及仓库内 UID 规则，避免普通追踪判断反复询问。
- [x] 仅按项目明确配置维护外部 tracker；稳定键与链接双向对应，恢复时吸收最新人工修正，不覆盖成熟工作流。
- [x] 保留模型五维标识、提交关联与既有字段，完成本地规范文本和相称静态检查。

本记录的完成范围是本工作副本的规范文本及检查；实际 Git 提交、推送结果在本轮交付报告中逐项回读。不把准备工作当作外部同步，也未默认启用外部表格。本次未发现针对该规范维护需求的外部 tracker 映射，未写外部系统；业务任务仍按项目实际配置执行。提交尚未生成，commit-related 不填旧 HEAD 冒充本需求实现；本提交自身 SHA 留待下次实际 Issue 更新，不制造递归记录提交。

# Comments


## 20261028-082048_Codex_GPT-UNKNOWN-UNKNOWN-UNKNOWN-UNKNOWN

将用户关于任务分类与双向追踪的明确要求落实到规范、模板说明和本任务记录。开始时重新读取了本工作副本当前规则与任务上下文；保留项目既有内容，未替项目创建外部追踪系统。本次只检查相关文档、YAML、引用、UID和diff，不做业务构建、GUI或视觉验收。

当前可核实Agent为Codex、厂牌为GPT；本次确切版本、规模、推理级别与用户加速选择无执行级元数据，使用UNKNOWN。全局默认配置与priority不作为本次或历史FAST证据。

> [本次任务分类与追踪协作规范的需求及执行对话](codex://threads/01a172bc-a59e-74ad-9553-ff4370c9a0f0)
