# -*- coding: utf-8 -*-
"""⑥ 样式 token 化：在 :root 注入语义色板 token，并把高频硬编码 hex 替换为 var(--*)。值全部等于原色，保证零视觉回归。"""
import re
import sys

path = 'app/globals.css'
s = open(path, encoding='utf-8').read()

# 若上次已注入则不重复注入（以注释头为标记）
MARK = '语义色板 token'
if MARK not in s:
    PALETTE = [
        ("c-white", "#ffffff", "卡片表面 / 深色底上的白色前景"),
        ("c-surface-soft", "#fbf9fd", "浅色弹层 / 详情页壳渐变顶"),
        ("c-page-ink", "#30283d", "浅色详情页主文字（stage color）"),
        ("c-ink", "#332a3f", "浅色卡片标题 / 强调文字"),
        ("c-ink-strong", "#2a3350", "管理端强文字（行标题 / 大数字）"),
        ("c-muted", "#7e8798", "次要说明文字 small"),
        ("c-soft", "#7c8493", "次级描述文字"),
        ("c-faint", "#98a0b0", "最弱提示 / 时间戳"),
        ("c-body", "#5d6679", "正文次级文字"),
        ("c-label", "#596276", "表单标签"),
        ("c-field-ink", "#1f283a", "输入框文字"),
        ("c-caption", "#8a8093", "详情卡片小标签文字"),
        ("c-sub", "#8a8199", "商店/排行辅助文字"),
        ("c-note", "#7c7085", "owned 页说明文字"),
        ("c-border", "#e2d9ee", "手机端浅紫卡片描边"),
        ("c-border-card", "#e1dbe7", "图库/藏品卡片描边"),
        ("c-border-field", "#dfe3ea", "输入控件 / 顶栏描边"),
        ("c-border-row", "#e1e5ec", "列表行分隔描边"),
        ("c-border-soft", "#e0e4eb", "管理端卡片/面板描边"),
        ("c-divider", "#edf0f4", "行分隔线 / 进度条轨道"),
        ("c-border-sheet", "#ded8e6", "弹层/抽屉描边"),
        ("c-border-menu", "#e2dce8", "菜单/动作面板描边"),
        ("c-border-icon", "#e2dbe9", "详情页头部图标描边"),
        ("c-border-muted", "#ddd6e6", "浅色输入框描边"),
        ("c-border-detail", "#e5e0ee", "转让详情弹层描边"),
        ("c-field-bg", "#f9fafc", "输入框底色"),
        ("c-card-bg", "#faf8fc", "次级卡片 / 输入底色"),
        ("c-fill-soft", "#efe9f7", "徽标 / 奖牌浅紫底"),
        ("c-warm-bg", "#fff8e8", "暖金浅底"),
        ("c-purple-tint", "#eee8f6", "浅紫图标底"),
        ("c-brand", "#7a5fae", "手机端紫色点缀"),
        ("c-purple", "#6e56a5", "图标紫"),
        ("c-purple-ink", "#6b5f7d", "浅紫文字"),
        ("c-active", "#5c4890", "选中态紫色文字"),
        ("c-primary", "#5b4eaa", "管理端主按钮"),
        ("c-primary-strong", "#6a5bb8", "激活 chip / 统计图标"),
        ("c-chip", "#6a4fa0", "兑换码紫"),
        ("c-accent", "#6e62b7", "管理端小标题标注"),
        ("c-success", "#3fa67f", "成功绿"),
        ("c-danger", "#c75a6b", "危险红"),
        ("c-gold", "#f2c86f", "金色（焦点环/星星）"),
        ("c-gold-line", "#e5c36c", "金色强调线（导航激活）"),
    ]
    anchor = "  --radius: 1rem;\n}"
    lines = ["  /* ==== 语义色板 token（值=原硬编码，保证零视觉回归；按用途分组） ===="]
    lines += [f"  --{n}: {h};  /* {c} */" for n, h, c in PALETTE]
    s = s.replace(anchor, "  --radius: 1rem;\n" + "\n".join(lines) + "\n}", 1)
    print('injected token block')
else:
    print('token block already present')

# 定位首个顶层 :root 结束行（depth 归零）
lines = s.split('\n')
depth = 0
seen = False
root_end = -1
for i, l in enumerate(lines):
    if not seen and ':root' in l and '{' in l:
        seen = True
    if seen:
        depth += l.count('{') - l.count('}')
        if depth == 0:
            root_end = i
            break
assert root_end != -1
head = '\n'.join(lines[:root_end + 1])
tail = '\n'.join(lines[root_end + 1:])

MAP = {
    "#ffffff": "c-white", "#fbf9fd": "c-surface-soft", "#30283d": "c-page-ink",
    "#332a3f": "c-ink", "#2a3350": "c-ink-strong", "#7e8798": "c-muted",
    "#7c8493": "c-soft", "#98a0b0": "c-faint", "#5d6679": "c-body",
    "#596276": "c-label", "#1f283a": "c-field-ink", "#8a8093": "c-caption",
    "#8a8199": "c-sub", "#7c7085": "c-note", "#e2d9ee": "c-border",
    "#e1dbe7": "c-border-card", "#dfe3ea": "c-border-field", "#e1e5ec": "c-border-row",
    "#e0e4eb": "c-border-soft", "#edf0f4": "c-divider", "#ded8e6": "c-border-sheet",
    "#e2dce8": "c-border-menu", "#e2dbe9": "c-border-icon", "#ddd6e6": "c-border-muted",
    "#e5e0ee": "c-border-detail", "#f9fafc": "c-field-bg", "#faf8fc": "c-card-bg",
    "#efe9f7": "c-fill-soft", "#fff8e8": "c-warm-bg", "#eee8f6": "c-purple-tint",
    "#7a5fae": "c-brand", "#6e56a5": "c-purple", "#6b5f7d": "c-purple-ink",
    "#5c4890": "c-active", "#5b4eaa": "c-primary", "#6a5bb8": "c-primary-strong",
    "#6a4fa0": "c-chip", "#6e62b7": "c-accent", "#3fa67f": "c-success",
    "#c75a6b": "c-danger", "#f2c86f": "c-gold", "#e5c36c": "c-gold-line",
    "#7762bc": "ring",  # 复用已有 --ring
}


def norm(h):
    if not h.startswith('#'):
        h = '#' + h
    h = h.lower()
    if len(h) == 4:
        h = '#' + ''.join(c * 2 for c in h[1:])
    return h


count = {}


def do_replace(m):
    key = norm(m.group(1))
    name = MAP.get(key)
    if name is None:
        return m.group(0)
    count[name] = count.get(name, 0) + 1
    return f'var(--{name})'


new_tail = re.sub(r'#([0-9a-fA-F]{3,8})(?![0-9a-fA-F])', do_replace, tail)
open(path, 'w', encoding='utf-8', newline='\n').write(head + '\n' + new_tail)
print('total replaced:', sum(count.values()))
for k in sorted(count):
    print(f"  --{k:16s} x{count[k]}")
