# Eagle 插件开发 Skill 使用指南

这个目录包含了 Eagle 插件开发的完整资源，可以在不同的 Claude 环境中使用。

## 📦 包含的文件

### 1. Claude Code Skill（推荐用于开发）
- **文件**: `.claude/skills/eagle-plugin-skill.tar.gz`
- **用途**: 在 Claude Code CLI 中使用
- **适用于**: 开发者在使用 Claude Code 进行 Eagle 插件开发时

### 2. Claude.ai Projects 知识库

- **文件**: `Eagle-Plugin-Development-Guide.md`
- **用途**: 上传到 Claude.ai 网页版的 Projects
- **适用于**: 在浏览器中使用 Claude 获取 Eagle 插件开发帮助

### 3. Skill 源文件
- **目录**: `.claude/skills/eagle-plugin/`
- **包含**:
  - `SKILL.md` - 主要技能文件
  - `api-reference.md` - 完整 API 参考
  - `examples.md` - 实用示例代码

---

## 🚀 安装和使用

### 选项 1: Claude Code CLI（推荐）

如果您正在使用 Claude Code CLI 进行开发：

#### 方法 A：使用压缩包

1. 解压 skill 文件：
   ```bash
   cd ~/.claude/skills
   tar -xzf /path/to/eagle-plugin-skill.tar.gz
   ```

2. 重启 Claude Code 或刷新 skills：
   ```bash
   # Skills 会自动加载
   ```

3. 验证安装：
   在 Claude Code 中询问："What skills are available?"

#### 方法 B：复制源文件

1. 复制整个目录到个人 skills 文件夹：
   ```bash
   cp -r .claude/skills/eagle-plugin ~/.claude/skills/
   ```

2. 或者复制到项目 skills 文件夹（仅当前项目使用）：
   ```bash
   # 已经在项目中，无需额外操作
   ```

### 选项 2: Claude.ai 网页版 Projects

如果您想在 Claude.ai 网页版中使用：

1. 访问 https://claude.ai

2. 创建新的 Project 或打开现有 Project

3. 点击 "Add Content" 或 "Project Knowledge"

4. 上传 `Eagle-Plugin-Development-Guide.md` 文件

5. 现在您可以在该 Project 中询问 Eagle 插件开发相关问题

---

## 💡 使用示例

### 在 Claude Code 中

当 skill 安装后，Claude 会自动识别与 Eagle 插件开发相关的请求：

```
您: 创建一个 Eagle 插件，用于导出选中的图片信息到 JSON

Claude: 我将使用 eagle-plugin skill 帮您创建插件...
```

```
您: Eagle API 中如何获取所有标签？

Claude: [自动加载 API 参考并提供答案]
```

```
您: 给我一个 Eagle 插件的示例代码

Claude: [从 examples.md 中提供相关示例]
```

### 在 Claude.ai Projects 中

在上传了知识库文件的 Project 中：

```
您: 如何创建 Eagle 窗口插件？

Claude: 根据知识库，创建 Eagle 窗口插件需要...
```

---

## 📚 Skill 内容概览

### SKILL.md - 核心指南
- Eagle 插件类型介绍
- manifest.json 配置
- 基础 API 使用
- 开发工作流程
- 最佳实践
- 常见问题解决

### api-reference.md - 完整 API
- Item API - 项目管理
- Folder API - 文件夹管理
- Tag API - 标签管理
- Library API - 资源库访问
- Window API - 窗口控制
- Dialog API - 对话框
- Notification API - 通知
- Context Menu API - 右键菜单
- Clipboard API - 剪贴板
- App API - 应用信息
- Event API - 事件处理
- Log API - 日志工具
- OS & System APIs - 系统 API

### examples.md - 实用示例
1. 基础窗口插件
2. 图片批处理器
3. 标签管理器
4. 导出到 JSON
5. 文件夹组织器
6. 自定义查看器
7. 后台服务
8. 国际化支持

---

## 🎯 Skill 触发关键词

当您的请求包含这些关键词时，Skill 会自动激活：

- "Eagle 插件"
- "Eagle plugin"
- "Eagle API"
- "manifest.json"
- "eagle.item"
- "eagle.folder"
- "创建 Eagle 插件"
- "Eagle 插件开发"

---

## 🔧 自定义 Skill

您可以根据需要修改 skill：

1. 编辑 `.claude/skills/eagle-plugin/SKILL.md` 添加自定义指导
2. 在 `examples.md` 中添加您自己的示例
3. 更新 `api-reference.md` 添加新的 API 发现

修改后，Claude Code 会自动重新加载 skill。

---

## 📖 文档来源

本 skill 基于 Eagle 官方插件开发文档创建：
https://developer.eagle.cool/plugin-api/zh-cn

---

## 🤝 分享 Skill

### 分享给其他 Claude Code 用户

1. 分享 `.claude/skills/eagle-plugin-skill.tar.gz` 文件
2. 接收者解压到他们的 `~/.claude/skills/` 目录

### 分享给 Claude.ai 用户

分享 `Eagle-Plugin-Development-Guide.md` 文件，他们可以上传到自己的 Projects。

---

## ⚙️ Skill 配置

### manifest 字段

```yaml
---
name: eagle-plugin
description: Develop Eagle plugins using official API. Use when creating Eagle plugins, working with Eagle API, or when user mentions Eagle plugin development, manifest.json, or Eagle application integration.
---
```

### 可选：限制工具访问

如果您希望限制 skill 可以使用的工具，可以添加：

```yaml
---
name: eagle-plugin
description: ...
allowed-tools: Read, Write, Grep, Glob
---
```

---

## 🐛 故障排除

### Skill 未激活

**问题**: Claude 没有使用 skill

**解决方案**:
1. 确认文件路径正确：`~/.claude/skills/eagle-plugin/SKILL.md`
2. 检查 YAML 格式（只用空格，不用 Tab）
3. 重启 Claude Code
4. 尝试更明确的请求："使用 eagle-plugin skill 帮我..."

### Skill 文件未找到

**问题**: "文件未找到" 错误

**解决方案**:
1. 确认解压到正确位置
2. 检查文件权限：`chmod -R 755 ~/.claude/skills/eagle-plugin`
3. 验证文件存在：`ls -la ~/.claude/skills/eagle-plugin/`

### Claude.ai 无法使用 Skill

**说明**: Claude.ai 网页版不支持 "skills" 功能。
**替代方案**: 使用 `Eagle-Plugin-Development-Guide.md` 作为 Project Knowledge。

---

## 📞 获取帮助

如果您在使用过程中遇到问题：

1. **Claude Code Issues**: https://github.com/anthropics/claude-code/issues
2. **Eagle 开发文档**: https://developer.eagle.cool/plugin-api/zh-cn
3. **Eagle 社区**: 加入 Eagle 官方开发者群

---

## 📝 版本信息

- **Skill 版本**: 1.0.0
- **创建日期**: 2026-01-06
- **适用于**:
  - Claude Code CLI
  - Claude.ai Projects
  - Eagle 3.0+

---

## ✨ 功能特性

✅ 完整的 Eagle API 参考
✅ 8 个实用示例代码
✅ 最佳实践指南
✅ 中文文档
✅ 即开即用
✅ 支持多种使用方式
✅ 定期更新

---

**享受使用 Claude 开发 Eagle 插件的乐趣！** 🚀
