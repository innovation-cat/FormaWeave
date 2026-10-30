# FormaWeave · 织象

[打开在线工作台](https://innovation-cat.github.io/FormaWeave/)

以代码构建，以模型生成，让想象成形。

本仓库只保存 FormaWeave 的静态网页和 GitHub Pages 部署配置，使用独立的提交历史。当前界面支持 Code2Video / Manim 视频创作；其他引擎、生成式模型与世界模型属于后续规划。

## 使用

1. 在已安装本地引擎的电脑上运行 `Start-Code2X.cmd`。
2. 打开在线工作台，在「连接设置」中填写 `http://127.0.0.1:8765`。
3. 输入本机工作台提供的连接令牌；令牌也可以在本机 `data/access-token.txt` 中读取。
4. 配置模型服务后即可创作。中英文配音、画质、目标时长和视觉风格按所选设置执行。

网页运行在浏览器中，计算任务由本地引擎执行。本仓库不包含 Python 后端、Agent、提示词模板、运行环境、模型密钥或生成作品，也不提供这些文件的公开下载。前端 HTML / CSS / JavaScript 是正常公开的网页资源。

## 发布

`main` 分支的网页更新通过 GitHub Actions 自动发布。工作流会检查仓库文件列表，仅接受网页资源、本文档和部署配置。部署版本可在站点的 `deployment.json` 查看。
