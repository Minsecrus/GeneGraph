# GeneGraph

GeneGraph 是一个面向高中遗传学教学的可视化杂交模拟工具。它支持输入亲本基因型、生成配子与棋盘格、根据规则自动匹配表现型，并统计基因型比与表现型比。

在线部署目标：GitHub Pages  
仓库地址：[https://github.com/Minsecrus/GeneGraph](https://github.com/Minsecrus/GeneGraph)

## 功能

- 智能解析基因型文本，如 `AaBb`、`aaBB`、`AaBbCc`
- 自动标准化位点顺序与等位基因写法
- 生成配子组合与 Punnett Square
- 规则驱动的表现型匹配
- 支持局部规则、精确杂合规则和多位点联合规则
- 自动统计基因型比与表现型比
- 支持按同尾字推断表现型分组，并展示可分解比例

## 规则写法

支持以下格式：

```text
A_ 黄色
aa 绿色
__bb 白色
A_Bb 紫色
```

也支持带箭头：

```text
A_ -> 黄色
aa -> 绿色
```

规则说明：

- `A_`：该位点有显性等位基因
- `aa`：该位点是隐性纯合
- `Bb`：该位点精确为杂合
- `__bb`：前一对位点任意，后一对位点为 `bb`
- 多个位点可共同决定同一性状

## 本地开发

```bash
pnpm install
pnpm dev
```

构建：

```bash
pnpm build
```

预览构建结果：

```bash
pnpm preview
```

## GitHub Pages 部署

项目已配置 GitHub Actions 自动部署到 GitHub Pages。

首次启用时请在 GitHub 仓库设置中确认：

1. 打开 `Settings`
2. 进入 `Pages`
3. 将 `Build and deployment` 设置为 `GitHub Actions`

之后推送到 `main` 分支会自动部署。

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS v4

## 许可证

本项目使用 [MIT License](./LICENSE)。
