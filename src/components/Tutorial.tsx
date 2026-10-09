export type TutorialTopic = 'start' | 'syntax';
export function Tutorial({ topic }: { topic: TutorialTopic }) {
  if (topic === 'start') return <div className="reference-content">
    <div className="eyebrow">从一个对话开始</div>
    <h3>查看故事的分支</h3>
    <p>顶栏分别进入“演绎”“分支”“世界状态”和“事件记录”，每个页面只显示对应功能。在“分支”中选择一个段落。“合并顺序对话”把连续内容上下排列，分隔线上的小箭头表示玩家点击继续；“分解顺序对话”逐句拆成框并连线。真正的选项始终连到各自的回应。</p>
    <h3>修改对白与选项</h3>
    <p>点击框内内容，编辑每次显示的对白和玩家选项。“第几次显示”之间的“玩家点击继续”标出点击位置，文字在输入框内自动换行不增加点击。连接成一次显示的多段内容共用一个编号。修改后点击“写回 Markdown”，对白与选项一起保存。点击框的名称打开原文，会定位到对应行；关闭原文后回到工作区。</p>
    <h3>读懂状态与条件</h3>
    <p>青绿色的“状态结果”用“条目：结果”显示对话或行为产生的事实，例如“已接下委托：是”。点击“来自对话”等来源链接，画布会定位并标出原始对话或选项。结果面板只读。黄色的“条件判断”区分“全部满足”和“任一满足”，出口显示各自去向；点击“修改条件”，用条目、比较方式和结果控件调整，再点击“应用条件”。对白中间的状态结果保留在对应点击位置。</p>
    <h3>调整结构</h3>
    <p>拖到同组选项交换次序，或拖到高亮出口交换后继。空白处放手会归位。排布由故事结构决定。</p>
    <h3>预演与保存</h3>
    <p>切换到“演绎”，默认每次点击“继续”显示下一句，选项出现后再作选择。勾选“自动展开顺序对话”可快速测试，它会停在真正的选择或行动等待处。遇到等待时推进世界时间，或切换到“世界状态”模拟行动结果、触发交互；回到“演绎”继续。切换页面保留进度和分支图位置。修改剧情后点击“从头预演”应用。</p>
    <p>文档自动保存在当前浏览器。“导出 Markdown”保存剧本文件，“保存进度”保存当前世界和未完成的行动。</p>
  </div>;
  return <div className="reference-content">
    <div className="eyebrow">写下世界的因果</div>
    <p>Markdown 写设计说明。标记为 <code>ink</code> 的代码块参与预演；说明和双链会原样保留。</p>
    <h3>剧情入口</h3>
    <pre>{'=== clearance_pressure ===\n# id: clearance_pressure\n# title: 清运提前\n# on: world.changed\n# when: premature_accusation\n# once: save'}</pre>
    <p><code>on</code> 指定触发事件，<code>when</code> 使用 Ink 条件，<code>once: save</code> 表示每份存档最多启动一次。</p>
    <h3>发出行为并等待</h3>
    <pre>{'>>> await npc.move actor=cat to=wall_niche duration=5m result=cat_path_result'}</pre>
    <p>每条行为语句写在同一行。预演器支持 <code>npc.travel</code> 和 <code>npc.move</code>，结果返回到预先声明的变量。</p>
    <h3>边走边说</h3>
    <pre>{'>>> start npc.move actor=cat to=wall_niche duration=5m as=cat_route\n周渡：我守着通路。\n>>> await cat_route result=cat_path_result\n周渡：现在复查它带出的东西。'}</pre>
    <h3>结果与事件</h3>
    <pre>{'{ cat_path_result == "completed":\n    ~ ledger_corner = true\n}\n>>> emit event=case.reported'}</pre>
    <p>结果可以是 <code>completed</code>、<code>blocked</code>、<code>cancelled</code> 或 <code>actor_missing</code>。这些行为和入口是墨线的扩展协议。</p>
    <h3>图形编辑</h3>
    <p>顺序对白可合并或逐句分解；合并时用“点击继续”与箭头标记继续，分解时用连线显示继续。切换只改变显示，不改写 Ink。Ink 的普通换行对应一次继续，空行不增加点击，glue（&lt;&gt;）连接的内容属于同一次显示。选择和条件分支连接到各自的后续框。图从左到右自动排布；拖到同组选项交换次序，拖到高亮出口交换后继，空白处放手会归位。点击对白框可分别修改每次显示的内容和选项文字，出现条件与后续连接保留。带表达式的动态内容以及新增点击可从框名打开原文编辑。</p>
    <h3>两种保存</h3>
    <p>“导出 Markdown”保存作者文档。“保存进度”保存世界时间、Ink 执行位置与未完成行为。</p>
  </div>;
}
