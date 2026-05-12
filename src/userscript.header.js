// ==UserScript==
// @name         抖音粉丝自动移除
// @namespace    Violentmonkey Scripts
// @version      0.4.1
// @changelog    修复表情昵称和空白昵称粉丝在列表底部被误判为无可删目标的问题；保留按非互关阈值自动触底的策略；同步将每日上限文案更新为 2500 人；
// @description  在网页版抖音粉丝弹窗中自动移除粉丝，支持暂停、批量处理和跳过相互关注
// @author       Frequenk
// @license      GPL-3.0 License
// @match        *://www.douyin.com/user/self*
// @grant        none
// @run-at       document-idle
// @downloadURL https://update.greasyfork.org/scripts/576245/%E6%8A%96%E9%9F%B3%E7%B2%89%E4%B8%9D%E8%87%AA%E5%8A%A8%E7%A7%BB%E9%99%A4.user.js
// @updateURL   https://update.greasyfork.org/scripts/576245/%E6%8A%96%E9%9F%B3%E7%B2%89%E4%B8%9D%E8%87%AA%E5%8A%A8%E7%A7%BB%E9%99%A4.meta.js
// ==/UserScript==
