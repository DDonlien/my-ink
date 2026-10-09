---
id: guard_walk
title: 跟上守卫
schema: 1
---

# 跟上守卫

试验“边走边说”，然后等待行动完成。

```ink
VAR guard_alive = true
VAR guard_location = "square"
VAR guard_state = "idle"
VAR walk_result = ""
-> DONE

=== follow_guard ===
# id: follow_guard
# title: 前往城门
# on: start
# once: save

>>> start npc.move actor=guard to=gate duration=1h as=guard_walk
守卫：跟我来。我边走边向你解释。
>>> await guard_walk result=walk_result

{ walk_result == "completed":
    守卫：到了。就是这里。
- else:
    守卫：看来我们得晚些再去了。
}
-> DONE

=== check_square ===
# id: check_square
# title: 广场上的钟声
# on: inspect.square

广场的钟响了。另一段剧情可以在守卫行走时继续。
-> DONE
```
