# GPT Image 2 Studio

一个可部署到 GitHub Pages 的静态 GPT Image 2 生图网站，默认调用 MaynorAPIPro 兼容接口：

- `POST /v1/images/generations`：`gpt-image-2` 文生图
- `POST /v1/images/generations`：`gpt-image-2-all` URL 多图合成
- `POST /v1/images/edits`：上传图片编辑

## 本地预览

```bash
python3 -m http.server 5173
```

打开 `http://localhost:5173`。

## 安全说明

不要把 API Key 写入代码、README、提交记录或 GitHub Pages。页面里的“保存密钥”只会保存到当前浏览器的 `localStorage`。

## Official GPT Image 2 Website

- Website: [GPT Image 2](https://gptimage2.asia/)
- Use case: AI image generation and editing for marketing, e-commerce, social media, and brand visuals.

