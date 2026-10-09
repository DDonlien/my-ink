---
id: man_cat_case_01
title: 无人接听的房间
schema: 1
status: draft
project: 二重证言
branch: man-cat
act: 0
baseline: double-deposition-1980s
adaptation: Web 文字预演
proof_variant: 旧煤柜发现遗体（原案待确认方案）
---

# 第 0 幕 · 无人接听的房间

《二重证言》man-cat 人猫版本的第一案。1980 年代，镜港。周渡的试岗任务是查明租客是否退房，以及这间房能否清空。

角色：[[周渡]]、[[梁照泉|梁叔]]、[[黑猫]]、[[阿澈]]、[[阿澈的男友]]、[[许明昌]]、[[陶启文]]。邻居和餐厅老板娘在尚未问名的预演对白中只使用称谓。

**预演路径**：接下查验 → 解开储物间外扣 → 喂猫并检查房间 → 人类询问 / 黑猫残留 → 人类移柜、黑猫取纸 → 取得许可 → 核验物证 → 手动确认四项结论 → 提交房屋鉴定报告。

黑猫的残留没有可靠人脸和时标，不能单独证明身份、死亡或罪责。询问顺序可以交换。笔记节点在本预演中以“选择证据组合 → 确认结论”表达，实际游戏的贴卡操作仍由游戏界面实现。

## 案件来源与改编边界

内容依据现有 man-cat 资料：

- [案情大纲](/Users/taobe/Projects/Gitea/double-deposition/man-cat/universe/story/outline/第0幕-无人接听的房间.md)
- [任务结构](/Users/taobe/Projects/Gitea/double-deposition/man-cat/universe/script/quest/第0幕-无人接听的房间.md)
- [当前正文](/Users/taobe/Projects/Gitea/double-deposition/man-cat/universe/story/正文/第0幕-无人接听的房间.md)
- [正史与未决方案](/Users/taobe/Projects/Gitea/double-deposition/man-cat/universe/canon/open-question.md)

本文件是独立的工具模板，不回写原案。对白与操作选项为预演改编；旧煤柜发现遗体采用当前草稿的可核证方案，尚不代表作者最终定案。两次窄路行动的 5 分钟为模拟参数，不作为剧情正史时间。

**操作提示**：遇到等待时可推进 5 分钟，或在右侧模拟完成 / 受阻 / 取消。等待期间可从右侧询问邻居、餐厅老板娘。可以保存待完成行动，重新开始，再恢复。提前指控会加快清运，未记录的原始推车登记可能丢失；仍可提交有限报告。

## 可执行剧本

```ink
VAR case_started = false
VAR cat_alive = true
VAR cat_location = "storage_room"
VAR cat_state = "hungry"
VAR cat_fed = false
VAR cat_path_result = ""
VAR room_checked = false
VAR past_window = false
VAR past_conflict = false
VAR niche_open = false
VAR ledger_corner = false
VAR neighbor_checked = false
VAR restaurant_checked = false
VAR ache_left_seen = false
VAR agent_checked = false
VAR agent_key_record = false
VAR technician_checked = false
VAR repair_order = false
VAR search_permit = false
VAR stolen_box = false
VAR cart_checked = false
VAR cart_records = false
VAR cart_trace = false
VAR garbage_permit = false
VAR coal_latch_open = false
VAR body_identified = false
VAR injury_checked = false
VAR window_theft_locked = false
VAR death_locked = false
VAR agent_actions_locked = false
VAR missing_status_locked = false
VAR premature_accusation = false
VAR cart_record_lost = false
VAR clearance_state = "scheduled"
VAR report_submitted = false
VAR report_quality = "未提交"
VAR house_state = "待查验"
VAR ache_status = "失联，待调查"
VAR phone_trace = "尚未取得"
-> DONE

=== job_interview ===
# id: job_interview
# title: 回声地产 · 试岗
# on: start

镜港。雨敲着青年旅舍的铁窗。周渡能付的只剩下一晚房钱。
小巷里的招聘启事把他带到回声地产。老板梁照泉将一张委托底单推过桌面。
梁叔：你能分辨一间房究竟是空着，还是被人急着说成空着吗？
周渡：看了才知道。
底单上写着：租客阿澈欠租失联，代理人许明昌要求清房重挂。
* [接下旧公寓的查验委托]
    ~ case_started = true
    -> apartment_arrival

=== apartment_arrival ===
# id: apartment_arrival
# title: 储物间外面的插销

许明昌在旧公寓门口等着。他说租客只是拖欠房租，催你尽快清房。
外门被钥匙打开，储物间里传来空碗撞门的声音。插销扣在外面。
* [解开外扣，放出黑猫]
    ~ cat_location = "apartment"
    一团黑影冲过周渡的膝盖。他差点以为是一只大黑狗。
    黑猫瘦得骨节很清楚，绕着门转，不肯立刻让人碰。
    -> investigation_hub

=== investigation_hub ===
# id: investigation_hub
# title: 旧公寓 · 选择调查方向

周渡把查验底单翻到空白的一面。
+ {not cat_fed} [给黑猫水和食物]
    ~ cat_fed = true
    ~ cat_state = "idle"
    黑猫先喝水，再吃食物。它渐渐缓过来，开始望向窗沿。
    -> investigation_hub
+ {not room_checked} [检查半收的行李、门槛和低柜]
    ~ room_checked = true
    ~ house_state = "暂停清房，待核验"
    行李只收了一半。门槛边的深色痕迹被擦过，低柜后有一枚男式袖扣，两副碗筷只洗了一副。
    周渡：先记录位置。现在只能说退租说法有疑点，不能先写成凶案。
    -> investigation_hub
+ {cat_fed and not past_window} [切换黑猫，观察窗沿与壁龛的过去行为]
    ~ past_window = true
    黑猫先扒窗沿，又跑回壁龛。窗锁铁舌被磨薄，窗框夹着布线，房门的锁却完好。
    黑猫看到有人从窗沿取走一只盒子，又看到一只手从门的方向伸向壁龛。
    两段动作没有清楚的脸，也没有可靠时标。不能把它们拼成同一次入屋。
    -> investigation_hub
+ {past_window and not niche_open} [切回周渡，移开低柜给黑猫造路]
    ~ niche_open = true
    周渡移开低柜，通风井旁的窄缝露出来。成年人伸不进手，黑猫可以过去。
    -> investigation_hub
+ {cat_fed and niche_open and not ledger_corner} [让黑猫沿窄缝取出账页边角]
    -> cat_niche_route ->
    -> investigation_hub
+ {not neighbor_checked} [询问楼上的邻居]
    -> neighbor_testimony ->
    -> investigation_hub
+ {not restaurant_checked} [询问一楼餐厅老板娘]
    -> restaurant_testimony ->
    -> investigation_hub
+ {not agent_checked} [核对委托底单，询问代理人的钥匙与夜访]
    ~ agent_checked = true
    ~ agent_key_record = true
    底单确认许明昌持有房门钥匙。门锁没有被撬，壁龛门上的擦印与窗沿不同。
    许明昌：按季度收租，顺便来看看房。
    周渡：半夜收？
    他没有回答。钥匙与门侧痕迹支持夜访路线，还不能据此认定谁造成伤害。
    -> investigation_hub
+ {not technician_checked} [核对电话工单，询问维修员]
    ~ technician_checked = true
    ~ repair_order = true
    电话工单上写着陶启文。住户对非派工时段窗外来人的记录，与破坏的窗锁、遗留布线可以互相核对。
    陶启文说自己没有夜间翻窗，手臂的划痕是工作时被铁丝划的。
    否认不是证明。先查失窃的盒子，也要分开合法派工与后来的入屋。
    -> investigation_hub
+ {repair_order and past_window and not search_permit} [取得搜查许可，请警方协查失窃衣物盒]
    ~ search_permit = true
    你提交窗锁、工单和非工作时段入屋的疑点。取得许可后，警方协助核查存放物，不自行闯入私人空间。
    -> investigation_hub
+ {search_permit and not stolen_box} [核验衣物盒及盒底的账本压痕]
    ~ stolen_box = true
    陶启文存放处的失窃衣物盒与房内缺失物相符。盒底留下方形账本压痕，可与账页边角复查。
    周渡：窗路上的人取走整只衣物盒；门路上的人查看壁龛。这两种行为可以是不同的人做的。
    -> investigation_hub
+ {cat_fed and room_checked and not past_conflict} [切换黑猫，复查冲突与后来搬运的残留]
    ~ past_conflict = true
    有人与男友扭打，黑猫扑向一条手臂。很久以后，另一双脚才把重物推出门。
    片段没有给出身份，也不能证明倒下的人死亡。你在笔记上写下两个要复查的方向。
    -> investigation_hub
+ {neighbor_checked and agent_checked and not cart_checked} [复查邻居站位、推车登记和垃圾房轮印]
    ~ cart_checked = true
    ~ cart_trace = true
    站在邻居当时的位置，只能看见外套，无法看清推车上的盖布内部。擦洗边界和轮印一直延伸到垃圾房。
    {not cart_record_lost:
        ~ cart_records = true
        清运人员提供当晨推车的使用登记，可以独立核对许明昌使用推车的时间与方向。
    - else:
        原始推车登记随提前清运丢失。你仍保留邻居的观察范围、现场轮印与其他核证途径，但报告必须留下这项证据缺口。
    }
    -> investigation_hub
+ {cart_trace and not garbage_permit} [请梁叔保住查验委托，取得垃圾房开门许可]
    ~ garbage_permit = true
    梁叔保住查验委托。到场人员同意打开垃圾房，并保全尚未清走的东西。
    梁叔：先留住现场。许可给你，判断得自己做。
    -> investigation_hub
+ {cat_fed and garbage_permit and not coal_latch_open} [让黑猫从检修缝拨开旧煤柜背后的松扣]
    -> cat_coal_route ->
    -> investigation_hub
+ {coal_latch_open and not body_identified} [让到场人员开柜，核验遗体身份与袖扣]
    ~ body_identified = true
    柜中发现男友的遗体。断下的袖扣与房内那枚对得上，身份核验及现场保全由到场人员完成。
    邻居看到的是外套，不能证明男友活着离开。死亡至此才有独立核证。
    -> investigation_hub
+ {body_identified and repair_order and not injury_checked} [核对伤情、窗下台角和维修员手臂抓痕]
    ~ injury_checked = true
    后脑伤情与窗下水泥台角上的血痕相互吻合，维修员手臂上的抓痕又与闯窗冲突线索对应。
    周渡：要把冲突造成死亡，与次晨从门口搬运分开写，不能让一件外套替任何人签字。
    -> investigation_hub
+ [打开笔记，组合并确认四项结论]
    -> notebook
+ {not premature_accusation} [证据未齐就公开指控，要求立刻对质]
    ~ premature_accusation = true
    你提前把推测说成指控。消息传出，清运安排开始改变。
    -> investigation_hub
+ {room_checked} [起草房屋鉴定报告]
    -> appraisal_report

=== cat_niche_route ===
# id: cat_niche_route
# title: 黑猫 · 通风井窄缝

黑猫钻入低柜后方。周渡守着刚打开的通路。
>>> await npc.move actor=cat to=wall_niche duration=5m result=cat_path_result
{cat_path_result == "completed":
    ~ ledger_corner = true
    ~ phone_trace = "账页边角：41706，关联待核验"
    黑猫把账页边角拖出来。旧公司的账格旁残留着 41706；数字本身不能指认任何人，更不能凭号码把不同事件归为一人。
- else:
    黑猫没有完成这次取物。账页尚未取得，已打开的通路保留，可以再试。
}
->->

=== neighbor_testimony ===
# id: neighbor_testimony
# title: 邻居 · 观察范围

~ neighbor_checked = true
邻居：他们吵得厉害。第二天清早，我看见男友那件旧外套过去，旁边有辆盖着东西的推车。我以为他们都走了。
周渡：你看见他的脸了吗？
邻居：没有。楼道灯坏了一半，我只认得衣服。
笔记分开记录：听见争吵；亲眼看见外套和推车；“男友活着离开”是推断。
->->

=== restaurant_testimony ===
# id: restaurant_testimony
# title: 老板娘 · 最后一次亲见

~ restaurant_checked = true
~ ache_left_seen = true
~ ache_status = "冲突后曾独自逃出；此后去向与生死未证实"
老板娘：她问过外城的早班车。街对面有人站过几天。那晚我打烊，看见她一个人冲过街口，喊她，她也没回头。
老板娘没有看见闯窗的人，不知道跟踪的缘由，也不知道阿澈拐过街口以后去了哪里。
亲见能证明阿澈当时活着逃出，不能证明她现在安全。
->->

=== neighbor_event ===
# id: neighbor_event
# title: 等待期间 · 询问邻居
# on: question.neighbor
# when: case_started and not report_submitted and not neighbor_checked

-> neighbor_testimony ->
-> DONE

=== restaurant_event ===
# id: restaurant_event
# title: 等待期间 · 询问老板娘
# on: question.restaurant
# when: case_started and not report_submitted and not restaurant_checked

-> restaurant_testimony ->
-> DONE

=== clearance_pressure ===
# id: clearance_pressure
# title: 离屏进展 · 清运提前
# on: world.changed
# when: premature_accusation and not report_submitted
# once: save

~ clearance_state = "accelerated"
{not cart_records:
    ~ cart_record_lost = true
    过早的公开指控使清运提前。尚未留存的原始推车登记已无法取得；垃圾房查验仍有许可途径，不能补回这份原件。
- else:
    清运被提前，但你已留存原始推车登记。已取得的证据不会因为指控被吞掉。
}
-> DONE

=== cat_coal_route ===
# id: cat_coal_route
# title: 黑猫 · 垃圾房检修缝

黑猫从低矮检修缝摸向旧煤柜背面。周渡与到场人员在正常入口等待。
>>> await npc.move actor=cat to=coal_cabinet duration=5m result=cat_path_result
{cat_path_result == "completed":
    ~ coal_latch_open = true
    黑猫拨动盖布下的松扣，给到场人员留下可以开柜的位置。仍需人类开柜核验。
- else:
    松扣还没有拨开，柜内情况未知。检修缝保留，可以重试。
}
->->

=== notebook ===
# id: notebook
# title: 笔记 · 四项独立结论

证据只能支撑它所证明的那段行为。选中证据组合，再决定是否确认结论；错误解释不会删除已取得的线索。
+ {not window_theft_locked} [组合窗锁、工单与衣物盒]
    -> claim_window
+ {not death_locked} [组合冲突、遗体身份与伤情]
    -> claim_death
+ {not agent_actions_locked} [组合钥匙夜访、外套观察范围与搬运证据]
    -> claim_agent
+ {not missing_status_locked} [组合半收行李与街口目击]
    -> claim_missing
+ [把猫的片段直接当作凶手与死亡的证明]
    这个解释超出了证言范围。残留没有可靠人脸和日期，倒下也不等于死亡。线索仍在，继续核验。
    -> notebook
+ [返回现场调查]
    -> investigation_hub

=== claim_window ===
# id: claim_window
# title: 主张 · 闯窗盗窃

{past_window and repair_order and search_permit and stolen_box:
    坏窗锁、非派工时段入屋的记录、工单与核验后的失窃衣物盒，共同支持维修员的闯窗盗窃路线。
    这是关于取盒的结论，不等于他当时就是来找黑账。
    + [确认“陶启文闯窗盗取衣物盒”]
        ~ window_theft_locked = true
        闯窗盗窃节点已确认。门侧的壁龛夜访仍独立待查。
        -> notebook
    + [暂不确认，返回笔记]
        -> notebook
- else:
    证据不足：需复查窗锁与不同入屋方向，取得工单及非派工时段记录，并经许可核验失窃衣物盒。猫的取盒片段只能提示方向。
    -> notebook
}

=== claim_death ===
# id: claim_death
# title: 主张 · 冲突与死亡

{room_checked and repair_order and stolen_box and body_identified and injury_checked:
    屋内男友在场的物证、遗体身份核验、后脑伤情与水泥台角、维修员闯窗及手臂抓痕，构成彼此核对的证据链。
    + [确认“维修员再次闯窗，争斗造成男友死亡”]
        ~ death_locked = true
        男友死亡与致命冲突节点已确认，交警方继续调查责任。
        -> notebook
    + [暂不确认，返回笔记]
        -> notebook
- else:
    证据不足：死亡必须有遗体身份等独立核证，并核对伤情、窗下台角、男友在场和维修员闯窗的物证。仅看见倒下不能锁定死亡。
    -> notebook
}

=== claim_agent ===
# id: claim_agent
# title: 主张 · 夜访与次晨搬运

{agent_key_record and neighbor_checked and cart_trace and body_identified:
    委托钥匙、门侧壁龛痕迹，与邻居仅见外套的观察范围、通向垃圾房的搬运轮印和遗体位置互相核对。
    {cart_records:原始推车登记进一步支持次晨使用推车的时间和方向。}
    {cart_record_lost:原始登记缺失必须保留在报告中，不能伪称已经留存。}
    + [确认“许明昌夜访壁龛，次晨掩盖现场并移尸”]
        ~ agent_actions_locked = true
        夜访与掩盖、移尸节点已确认。搬运遗体不自动等于造成死亡。
        -> notebook
    + [暂不确认，返回笔记]
        -> notebook
- else:
    证据不足：需核对钥匙与门侧痕迹、邻居的真实观察范围、搬运路线和遗体位置。持有钥匙不能单独证明移尸，更不能证明杀人。
    -> notebook
}

=== claim_missing ===
# id: claim_missing
# title: 主张 · 最后可证实的行动

{room_checked and restaurant_checked and ache_left_seen:
    半收行李与早班车询问说明她准备离开；餐厅老板娘的独立目击证明她在冲突后独自逃出街口。
    + [确认“阿澈当时逃出，此后去向与生死未证实”]
        ~ missing_status_locked = true
        ~ ache_status = "失踪，仍待查；冲突后逃出已核证"
        失踪状态节点已确认。最后一次活着被看见，与现在是否安全是不同的问题。
        -> notebook
    + [把早班车计划当作“现在已经安全离城”]
        计划不是乘车记录，街口目击也没有后续去向。这个候选解释尚不能确认，已有线索保留。
        -> notebook
    + [暂不确认，返回笔记]
        -> notebook
- else:
    证据不足：需复查半收行李，并取得餐厅老板娘关于街口的亲见证言。不能从行李或猫的记忆直接推定阿澈目前的生死。
    -> notebook
}

=== appraisal_report ===
# id: appraisal_report
# title: 房屋鉴定 · 已证事实与缺口

房屋鉴定报告草稿：
房况：退租说法存在疑点，应暂停普通清房与重新出租。
{window_theft_locked:已核证：闯窗盗窃衣物盒。|待查：窗路与失窃物的责任链尚未确认。}
{death_locked:已核证：男友死亡，维修员再次闯窗后的致命争斗须交警方调查。|待查：死亡与致命冲突尚未完成正式证据链确认。}
{agent_actions_locked:已核证：代理人钥匙夜访，与次晨掩盖、移尸为不同阶段。|待查：钥匙夜访与搬运责任尚未完成证据链确认。}
{missing_status_locked:阿澈：冲突后曾逃出，此后去向与生死未证实，仍按失踪待查。|阿澈：失联；最后可证实行动尚未确认。}
{cart_record_lost:证据缺口：原始推车登记已丢失，不能在报告中冒充已取得。}
{ledger_corner:暗线：账页边角 41706 另行保存，关联待核验。}
+ [继续调查，暂不提交]
    -> investigation_hub
+ [按当前已确认事实提交报告，保留所有缺口]
    ~ report_submitted = true
    {window_theft_locked and death_locked and agent_actions_locked and missing_status_locked:
        {cart_record_lost:
            ~ report_quality = "四项结论已确认，原始推车登记缺失"
        - else:
            ~ report_quality = "四项结论已确认，证据记录完整"
        }
    - else:
        ~ report_quality = "有限报告，未确认结论继续调查"
    }
    >>> emit event=case.reported
    -> DONE

=== report_aftermath ===
# id: report_aftermath
# title: 世界回应 · 房源与搭档
# on: case.reported
# when: report_submitted
# once: save

{death_locked:
    ~ house_state = "事故屋，暂缓出租并保全现场"
    梁叔：这间房不能按普通退租清空。死亡的调查归警方，阿澈的失踪也没有结束。
    房源暂时租不出去。梁叔让周渡免费暂住，嘱咐他不要碰已封存的地方。
    几天后，周渡给黑猫放了新水碗。黑影又迎面冲来，他想起开门时险些喊出的“大黑狗”。
    周渡：以后叫你黑狗，怎么样？
    黑猫回头看了他一眼，又望向阿澈曾坐过的窗边。新名字没有替旧主人回答，她去了哪里。
- else:
    ~ house_state = "暂停清房，补充核验"
    梁叔：你把能证明的与不能证明的分开了。房子先别动，缺的证据继续查。
    这是一份有限报告。它保住调查入口，没有自动替未确认的节点下结论。
}
-> DONE
```
