# 抖音粉丝自动移除

一个面向网页版抖音个人中心粉丝弹窗的用户脚本，核心目标是批量移除粉丝，并尽量减少手工重复点击。

## 功能概览

- 自动处理当前可见第一项粉丝，依次执行“移除”与“确认移除”
- 右侧悬浮面板支持开始、暂停与手动填写执行间隔
- 自动识别“相互关注”按钮并跳过对应用户
- 仅在 `https://www.douyin.com/user/self*` 生效，避免影响其他抖音页面

## 效果预览

本项目的介绍截图使用本次整理时的实拍图，也就是当前对话里提供的面板截图。

- 预留路径：`images/panel-screenshot.png`
- 说明文件：[images/README.md](images/README.md)

由于当前对话附件不能直接自动落盘到工作区，仓库里先保留了截图位说明；如果你要把截图真正放进仓库，直接把这张图保存到上面的路径即可。

## 安装

1. 安装 `Tampermonkey` 或 `Violentmonkey`
2. 打开项目根目录下的 `douyin-fans-remover.user.js`
3. 导入到脚本管理器后，访问 `https://www.douyin.com/user/self`
4. 打开粉丝弹窗，使用右侧悬浮面板控制脚本

## 开发

- 源码入口：[src/index.js](src/index.js)
- 用户脚本头：[src/userscript.header.js](src/userscript.header.js)
- 构建命令：`npm run build`
- 监听构建：`npm run build:watch`

## 文档

- [功能说明](docs/features.md)

## 许可证

本项目采用 [GPL-3.0 License](LICENSE)。
