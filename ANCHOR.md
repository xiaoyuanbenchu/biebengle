# ANCHOR · 《别绷了》项目记忆锚点

> 给明早来验收的你：这一个文件记录了项目的全部状态、我做过的每个方向决策及其理由。
> 游戏在线：**https://xiaoyuanbenchu.github.io/biebengle/**
> 本地运行：双击 `index.html`，或 `node serve.js` 后按打印的局域网地址用手机打开。

---

## 一句话

梗式搞笑抽象的一键反应小游戏：彩圈缩向白圈，重合瞬间按，按歪绷死一条🤡命。零依赖单文件网页，手机平板浏览器直接玩，PWA 可装主屏离线玩。

## 当前状态

- **版本：v3.0（进行中）** · 我（ZCode）受全权委托自主优化，验收时间：明早
- v1 单文件原型 → v2 圈型深度+成就+每日挑战+PWA+公网部署 → v3 正在做：见下方计划

## v3.0 计划（我评估后自选的方向）

1. **玩法深度**：新增反向圈（从小长大）；「绷王时刻」Boss 战（每 50 分触发，连续 3 个超窄金圈，全中拿成就）；险过提示「就差一点！」；出生速度随机抖动防背板
2. **生涯系统**：成就 8→16 个；累计绷力（生涯总分）+ 段位称号（摸鱼选手→绷学奇才）；主页「战绩」页（生涯数据 + 成就墙）
3. **视听打磨**：WebAudio 五声音阶背景音乐（随连击变强，极小音量，可静音）；星空漂移背景；彩圈拖尾；画面暗角
4. **工程**：sw.js 缓存版本提升强制客户端刷新；favicon/og 分享卡片；回归截图矩阵验证后 git push 上线

## 文件地图

| 文件 | 作用 |
|---|---|
| `index.html` | 整个游戏。梗文案/成就定义在 `<script>` 顶部常量区；核心是 spawn/press/loop/draw 四函数状态机（menu/play/over） |
| `sw.js` | Service Worker 离线缓存（CACHE 版本号 = 资源更新时必须手动 +1） |
| `manifest.webmanifest` / `icon-512.png` | PWA 清单与图标 |
| `icon.html` | 图标源文件（headless Edge 截图生成 PNG） |
| `serve.js` | 局域网试玩服务器（8934 端口，含路径穿越防护） |
| `shots/` | headless 回归截图（git 忽略） |

## 本地存档（localStorage）

`biebengle_best` 历史最高分 · `biebengle_achv` 成就 · `biebengle_seen` 圈型介绍看过没 · `biebengle_daily_<日期>` 每日挑战最佳 · `biebengle_stats` 生涯数据（v3 新增）

## 测试钩子（URL hash）

`#autotest` 自动开局强制命中 · `#autolose` 自动送命看结算页 · `#autodaily` 每日挑战自动局 · `#autostats` 直接开战绩页

## 关键决策日志（自主拍板部分）

- **做反向圈而不是幽灵圈**：幽灵圈消失式判定在手机小屏上是挫败感制造机；反向圈保持"看得见"的公平，只改变预判方向
- **Boss 战做成"金圈窄窗×3"而不是大血条**：单按钮游戏的 Boss 应该是极限手感时刻，不是数值堆砌
- **成就含一个负面成就**（手感冰凉/开局天胡类）：抽象游戏的趣味在于吐槽玩家
- **背景音乐默认开但音量极低**：mute 一键全关；用 `MUSIC_ON` 常量可整体禁用
- **不做排行榜**：需要后端+账号体系，破坏"发链接就能玩"的零摩擦传播，放路线图
- **不做皮肤/商店**：纯装饰内容对这款游戏的留存帮助小于玩法深度
- **每日种子取自本地日期**：跨时区玩家同关不同日，接受的限制（真全球同关需 UTC+公告页，过度设计）

## 验证方式（每次改动后跑这套）

```bash
node -e "const fs=require('fs');const m=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/);new Function(m[1]);console.log('OK')"
# headless 截图矩阵（menu / autotest / autolose / autostats）
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --window-size=390,844 --virtual-time-budget=15000 --screenshot=shots/<名>.png "http://127.0.0.1:8934/index.html#autotest"
```

## 路线图（backlog，按价值排序）

排行榜（CloudBase 云函数可零服务器实现）→ 新圈型池扩充 → 音量分离设置（音乐/音效）→ iOS 触感升级 → 多语言
