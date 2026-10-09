---
id: merchant_relocation
title: 商路的另一端
schema: 1
---

# 商路的另一端

一条路的关闭，让另一个城镇的生活悄悄改变。

**试演路径**：封闭商路 → 推进 3 小时 → 保存进度 →
恢复进度 → 再推进 3 小时 → 与商人交谈。

角色：[[守卫]]、[[商人]] · 地点：[[北方关卡]]、[[港口]]

```ink
VAR road_closed = false
VAR merchant_alive = true
VAR merchant_relocated = false
VAR merchant_location = "town_b"
VAR merchant_state = "idle"
VAR travel_result = ""
-> DONE

=== crossroads ===
# id: crossroads
# title: 北方关卡
# on: start

清晨的雾还没有散。最后一辆马车停在关卡前。
守卫：北方的桥塌了。你要封闭这条商路吗？

* [封闭北方商路]
    ~ road_closed = true
    -> road_sealed
* [让商队继续通行]
    守卫：明白。我会提醒他们小心。
    -> DONE

=== road_sealed ===
# id: road_sealed
# title: 落下的路障

你落下路障。远处，马车的铃声渐渐消失。
守卫：消息会传到镇上。有人得重新找一条路了。
-> DONE

=== merchant_relocate ===
# id: merchant_relocate
# title: 商人的迁居
# on: world.changed
# when: road_closed and merchant_alive and not merchant_relocated
# once: save

>>> await npc.travel actor=merchant to=harbor duration=6h result=travel_result
{ travel_result == "completed":
    ~ merchant_relocated = true
    >>> emit event=merchant.arrived
- else:
    ~ merchant_state = "blocked"
}
-> DONE

=== merchant_greeting ===
# id: merchant_greeting
# title: 港口重逢
# on: interact.merchant
# when: merchant_alive

{ merchant_relocated:
    港口的屋檐下，熟悉的货箱堆成一座小山。
    商人：旧路走不通了，所以我搬来了这里。
    商人：路可以断，日子总要继续。要看看新到的货吗？
- else:
    { merchant_state == "traveling":
        商人正在前往港口的路上。货车还未抵达。
    - else:
        商人：早上好。今天的商路还算太平吗？
    }
}
-> DONE
```

## 设计备注

旅行由预演器模拟。只有收到完成结果，迁居后的对话才会生效。
地图、寻路和实际演出，留给游戏引擎的行为适配器。
