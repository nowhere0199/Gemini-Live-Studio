# Gemini Live Studio — 中文

[← 英文主文档](../../README.md)

**Gemini Live Studio** 是面向 Google Gemini Live API 的本地 Web 界面。它支持语音和文字交互、图片与视频帧输入、会话事件查看，以及工具调用实验。

## 功能

- 实时麦克风音频流、原生音频播放，以及 API 提供时的输入/输出转写。
- 文字消息、图片上传、摄像头帧、视频抽帧和音频文件流式输入。
- 模型与声音选择、生成参数、Extended Thinking 推理深度。
- 会话恢复、上下文压缩、自定义系统指令和可选 Google Search。
- 工具调用需人工审核；不会仅因模型提出请求就执行任意代码。
- 事件日志、设置 payload 预览/复制、对话导出，以及用于排查蜂鸣/杂音的原始音频 WAV 导出。
- 多个 API 密钥配置、主题自定义和浏览器本地偏好设置。

## 快速开始

1. 安装 Node.js 20 或更高版本。
2. 下载或克隆此仓库。
3. Windows 运行 `start-local.cmd`；其他支持的系统运行 `node server.mjs`。
4. 打开 **http://127.0.0.1:8765**。
5. 输入自己的 Gemini API key，选择模型并点击 **Connect session**。
6. 仅在主动使用时授予麦克风或摄像头权限。

服务器默认只绑定 `127.0.0.1`。不要通过局域网、公网隧道或反向代理暴露该端口。

## 安全与隐私

本地服务器使用长期 API key 换取短时、一次性的 Live ephemeral token；长期 key 不会放入浏览器的 Live WebSocket URL。但已保存的 key 配置默认存储在浏览器 `localStorage` 中，**并未加密**。如需仅在当前会话使用，请关闭 “Remember this key”。

使用时，音频、文本、图像、视频帧和工具相关内容会发送给 Google。提交敏感信息前请检查相关政策和账户设置。可选的本地 CLI/skills 桥接只提供白名单只读检查，必须由用户启用并逐项批准，不是通用 shell。

## 音频诊断

如果出现蜂鸣、爆音或杂音，请在 Settings → Tools 导出最近一次模型音频 WAV，并在独立播放器中试听。如果 WAV 中也有杂音，说明问题已存在于接收到的音频数据中；如果 WAV 清晰但实时播放有噪声，应先检查浏览器调度、缓冲区、系统混音器、驱动和输出设备。这本身不能证明一定是模型问题。

当前版本针对 `gemini-3.8-live` 与 `gemini-3.8-live-extended-thinking`。模型可用性、配额和服务条款由 Google 决定。本项目独立开发，与 Google 无关联或背书关系。

请参阅[英文主文档](../../README.md)、[本地工具能力说明](../../LOCAL_AGENT_CAPABILITIES.md)和[许可证](../../LICENSE)。
