# 抖音粉丝自动移除

[![Greasy Fork](https://img.shields.io/greasyfork/v/576245?label=Greasy%20Fork&logo=greasyfork&logoColor=white)](https://greasyfork.org/zh-CN/scripts/576245-%E6%8A%96%E9%9F%B3%E7%B2%89%E4%B8%9D%E8%87%AA%E5%8A%A8%E7%A7%BB%E9%99%A4)
[![GitHub stars](https://img.shields.io/github/stars/Frequenk/douyin-fans-remover-userscript?style=flat&logo=github&label=Stars&color=white)](https://github.com/Frequenk/douyin-fans-remover-userscript/stargazers)
[![License](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

一个面向网页版抖音个人中心粉丝弹窗的用户脚本，用来批量移除粉丝并减少重复手工操作。脚本支持自动识别并跳过“相互关注”用户；当这些用户停留在可见区时，需要你手动滚动把它们移出可见区后再继续处理。按当前平台限制，每天上限移除 2000 人。

## 📸 效果预览

![功能面板截图](https://raw.githubusercontent.com/Frequenk/douyin-fans-remover-userscript/master/images/screenshot-1.png)

## ✨ 功能概览

- 自动处理粉丝弹窗中当前可见的可移除目标
- 支持面板收缩功能，可收缩为右侧居中的小球以减少视觉干扰
- 自动点击“移除”与“确认移除”
- 自动识别“相互关注”按钮并跳过
- 默认每轮同时移除最多 `5` 人，若当前可见人数不足则按实际数量处理
- 平台每天上限移除 `2000` 人
- 仅在 `https://www.douyin.com/user/self*` 生效

## 📦 安装

先安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/)。

然后任选一种方式：

1. 从 [Greasy Fork 一键安装](https://greasyfork.org/zh-CN/scripts/576245-%E6%8A%96%E9%9F%B3%E7%B2%89%E4%B8%9D%E8%87%AA%E5%8A%A8%E7%A7%BB%E9%99%A4)
2. 打开项目根目录下的 [douyin-fans-remover.user.js](douyin-fans-remover.user.js)，手动导入脚本管理器

## 🚀 使用方法

1. 打开 `https://www.douyin.com/user/self`
2. 进入个人中心后打开“粉丝”弹窗
3. 在页面右侧找到“抖音粉丝自动移除”悬浮面板
4. 点击“开始”启动，点击“暂停”随时停止

建议：

- 若当前可见区有“相互关注”，脚本会直接跳过；需要你手动滚动把它们移出可见区
- 脚本默认每轮会尽量同时处理当前可见区内最多 `5` 个可删目标
- 按当前平台限制，每天最多移除 `2000` 人

## 📚 详细文档

- [功能说明](docs/features.md)
- [协作约定](AGENTS.md)

## 🔗 相关链接

- [Greasy Fork 发布页](https://greasyfork.org/zh-CN/scripts/576245-%E6%8A%96%E9%9F%B3%E7%B2%89%E4%B8%9D%E8%87%AA%E5%8A%A8%E7%A7%BB%E9%99%A4)
- [GitHub 仓库](https://github.com/Frequenk/douyin-fans-remover-userscript)

## 📄 许可证

本项目采用 [GPL-3.0 License](https://opensource.org/licenses/GPL-3.0) 开源协议。

## ⭐ 支持

如果这个脚本对你有帮助，可以：

- 在 [Greasy Fork](https://greasyfork.org/zh-CN/scripts/576245-%E6%8A%96%E9%9F%B3%E7%B2%89%E4%B8%9D%E8%87%AA%E5%8A%A8%E7%A7%BB%E9%99%A4) 给个好评
- 在 [GitHub](https://github.com/Frequenk/douyin-fans-remover-userscript) 点个 Star
