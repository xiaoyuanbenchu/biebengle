/* 测试参数注入（浏览器 harness 专用）
   core.js 在浏览器路径下自给自足（localStorage/AudioContext/pointer/prompt），
   因此这里绝不定义 window.wx —— 否则 core.js 的 isWx 探测会误判平台。
   hash 约定：#hook名&k=v&k=v  →  __TEST__=hook名, __QUERY__={k:v} */
(function () {
  "use strict";
  const G = (typeof globalThis !== "undefined") ? globalThis : window;
  const hash = location.hash.replace(/^#/, "");
  const parts = hash.split("&");
  G.__TEST__ = parts[0] || "";
  const q = {};
  for (let i = 1; i < parts.length; i++) {
    const kv = parts[i].split("=");
    if (kv[0]) q[kv[0]] = decodeURIComponent(kv[1] || "");
  }
  G.__QUERY__ = q;
})();
