---
id: lighthouse_letter
title: 灯塔来信
schema: 1
---

# 灯塔来信

一个普通 Ink 示例：选择、变量和条件分支。

```ink
VAR letter_opened = false
-> arrival

=== arrival ===
# id: arrival
# title: 一封没有署名的信
# on: start

傍晚，有人把一封信塞进你的门缝。
信封上只有一句话：请在灯亮之前来。

* [打开信封]
    ~ letter_opened = true
    -> read_letter
* [直接前往灯塔]
    -> lighthouse

=== read_letter ===
# id: read_letter
# title: 信里的秘密

“今晚的光会照向陆地。别让船靠岸。”
你认出了字迹。这是失踪的灯塔守望者写的。
* [去灯塔寻找他]
    -> lighthouse
* [留在家里]
    窗外，灯塔的光慢慢转了过来。
    -> DONE

=== lighthouse ===
# id: lighthouse
# title: 灯光之下

守望者：你终于来了。
{ letter_opened:
    守望者：既然你读过信，应该知道今晚有什么不对。
- else:
    守望者：先读信吧。有些事，我们只有一次选择。
}
* [帮他把灯转向大海]
    光束掠过黑色的海面。一艘船无声地调转方向。
    -> DONE
* [问他为什么失踪]
    守望者：因为我看见了那些本不该回来的船。
    -> DONE
```
