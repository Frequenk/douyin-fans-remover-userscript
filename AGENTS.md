# AI Agent Guide — douyin-fans-remover-userscript

## 项目概览
- 这是一个面向网页版抖音个人中心粉丝弹窗的用户脚本。
- 发布形态是单文件 `douyin-fans-remover.user.js`，但日常开发应在 `src/` 下进行修改。
- 当前脚本只在 `https://www.douyin.com/user/self*` 生效。
- 主要能力包括：自动点击“移除”与“确认移除”、手动执行间隔、自动跳过“相互关注”用户、悬浮状态面板。

## 目录结构
- `src/index.js`：主逻辑入口，负责面板渲染、状态管理、粉丝项识别、相互关注跳过、点击和滚动流程。
- `src/userscript.header.js`：Userscript 元数据头，构建时拼接到输出顶部。
- `build.mjs`：esbuild 构建脚本。
- `douyin-fans-remover.user.js`：构建产物，可直接导入 Tampermonkey；不要把它当作主要修改入口。
- `docs/features.md`：功能说明。
- `images/`：项目截图与素材目录。

## 开发流程
1. 在 `src/` 下修改源码，不要直接手改根目录产物。
2. 如需安装依赖，执行 `npm install`。
3. 修改代码后执行 `npm run build`。
4. 确认根目录 `douyin-fans-remover.user.js` 已同步更新。

## 运行 / 调试建议
- 开发时可用 `npm run build:watch` 持续构建。
- 用户脚本调试主要依赖浏览器控制台、弹窗内 DOM 结构和真实交互行为验证。
- 这是单页环境；如果表现异常，除了看 DOM 结构，也要注意路由内切换和弹窗是否重新挂载。

## 修改约定
- 保持现有行为稳定，改动尽量局部、可回滚。
- 优先复用现有函数，不要把新的页面识别和点击逻辑散落到多个位置。
- 涉及粉丝列表识别时，优先检查：
  - `CONTAINER_SELECTOR`
  - `FOOTER_SELECTOR`
  - “移除”“确认移除”“相互关注”三个文案识别逻辑
- 不要随意更改本地存储 key 名，除非用户明确要求迁移，并同步处理兼容逻辑。

## 构建与发布约定
- 只有在用户明确要求“做发布准备”“更新版本号”“补 changelog”等场景时，才更新 `src/userscript.header.js` 中的 `@version`。
- 日常开发默认不改版本号。
- 只要改动涉及用户可感知的新功能、行为变化、设置项变化或文档描述变化，应同步更新 `README.md` 和 `docs/features.md`。
- 只要改动了代码，就应执行 `npm run build`，确保根目录产物与 `src/` 源码一致。

## 协作建议
- 先确认问题是在“列表项识别”“确认按钮识别”还是“滚动跳过逻辑”。
- 涉及误点时，优先核对可见性判断，再怀疑点击事件链。
- 涉及跳过异常时，优先核对“相互关注”按钮文案是否变化。
