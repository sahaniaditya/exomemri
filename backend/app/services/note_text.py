"""Pure helpers over TipTap JSON: plain-text extraction, link extraction, Markdown export.

Every function tolerates malformed input and unknown node types: unknown nodes
degrade to the text of their children and never raise.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

MAX_DEPTH = 40
MAX_CONTENT_TEXT = 200_000

Link = tuple[str, str]  # (target_type, target_id)


def _children(node: Any) -> list[dict]:
    content = node.get("content") if isinstance(node, dict) else None
    if not isinstance(content, list):
        return []
    return [child for child in content if isinstance(child, dict)]


def _attrs(node: dict) -> dict:
    attrs = node.get("attrs")
    return attrs if isinstance(attrs, dict) else {}


def _str(value: Any) -> str:
    return value if isinstance(value, str) else ""


def _atom_label(node: dict) -> str | None:
    """Display text for the capture/mention atoms; None for any other node."""
    if node.get("type") in {"captureEmbed", "noteMention", "sourceMention"}:
        return _str(_attrs(node).get("title"))
    return None


# --------------------------------------------------------------------------- text


def extract_text(doc: Any) -> str:
    """Searchable plain text: blocks separated by newlines, capped in length."""
    try:
        parts: list[str] = []
        _collect_text(doc, parts, 0)
        text = "\n".join(part for part in parts if part)
    except RecursionError:  # pragma: no cover - guarded by MAX_DEPTH
        return ""
    return text[:MAX_CONTENT_TEXT]


def _collect_text(node: Any, parts: list[str], depth: int) -> None:
    if not isinstance(node, dict) or depth > MAX_DEPTH:
        return
    if node.get("type") == "text":
        parts.append(_str(node.get("text")))
        return
    label = _atom_label(node)
    if label is not None:
        parts.append(label)
        return
    children = _children(node)
    if _is_textblock(node, children):
        parts.append("".join(_inline_plain(child, depth + 1) for child in children))
        return
    for child in children:
        _collect_text(child, parts, depth + 1)


def _is_textblock(node: dict, children: list[dict]) -> bool:
    if node.get("type") in {"paragraph", "heading", "toggleSummary", "codeBlock"}:
        return True
    return bool(children) and all(_is_inline(child) for child in children)


def _is_inline(node: dict) -> bool:
    return node.get("type") in {"text", "hardBreak", "noteMention", "sourceMention"}


def _inline_plain(node: dict, depth: int) -> str:
    if depth > MAX_DEPTH:
        return ""
    if node.get("type") == "text":
        return _str(node.get("text"))
    if node.get("type") == "hardBreak":
        return "\n"
    label = _atom_label(node)
    if label is not None:
        return label
    return "".join(_inline_plain(child, depth + 1) for child in _children(node))


# --------------------------------------------------------------------------- links


def extract_links(doc: Any) -> list[Link]:
    """Distinct ``(target_type, target_id)`` pairs referenced by embeds and mentions."""
    seen: dict[Link, None] = {}
    _collect_links(doc, seen, 0)
    return list(seen)


def _collect_links(node: Any, seen: dict[Link, None], depth: int) -> None:
    if not isinstance(node, dict) or depth > MAX_DEPTH:
        return
    node_type = node.get("type")
    attrs = _attrs(node)
    link: Link | None = None
    if node_type in {"captureEmbed", "sourceMention"}:
        link = ("source", _str(attrs.get("sourceId")))
    elif node_type == "noteMention":
        link = ("note", _str(attrs.get("noteId")))
    if link is not None:
        normalized = _normalize_uuid(link[1])
        if normalized:
            seen.setdefault((link[0], normalized), None)
    for child in _children(node):
        _collect_links(child, seen, depth + 1)


def _normalize_uuid(value: str) -> str | None:
    try:
        return str(UUID(value))
    except (ValueError, AttributeError, TypeError):
        return None


# ------------------------------------------------------------------------ markdown


def to_markdown(doc: Any, title: str | None = None) -> str:
    """Render the document as Markdown. ``title`` becomes a leading H1 when given."""
    try:
        body = _blocks(_children(doc) if _is_doc(doc) else [], 0)
    except RecursionError:  # pragma: no cover - guarded by MAX_DEPTH
        body = ""
    head = f"# {title.strip()}\n\n" if title and title.strip() else ""
    return (head + body).rstrip() + "\n"


def _is_doc(doc: Any) -> bool:
    return isinstance(doc, dict)


def _blocks(nodes: list[dict], depth: int) -> str:
    rendered = [_block(node, depth) for node in nodes]
    return "\n\n".join(part for part in rendered if part.strip())


def _block(node: dict, depth: int) -> str:
    if depth > MAX_DEPTH:
        return ""
    kind = node.get("type")
    attrs = _attrs(node)
    children = _children(node)
    if kind == "paragraph":
        return _inline(children)
    if kind == "heading":
        level = attrs.get("level")
        hashes = "#" * (level if isinstance(level, int) and 1 <= level <= 6 else 1)
        return f"{hashes} {_inline(children)}".rstrip()
    if kind in {"bulletList", "orderedList", "taskList"}:
        return _list(node, depth)
    if kind == "blockquote":
        return _quote(_blocks(children, depth + 1))
    if kind == "codeBlock":
        code = "".join(_str(child.get("text")) for child in children)
        return f"```{_str(attrs.get('language'))}\n{code}\n```"
    if kind == "horizontalRule":
        return "---"
    if kind == "image":
        return f"![image]({_str(attrs.get('key') or attrs.get('src'))})"
    if kind == "table":
        return _table(children)
    if kind == "callout":
        emoji = _str(attrs.get("emoji")) or "💡"
        return _quote(f"{emoji} {_blocks(children, depth + 1)}".rstrip())
    if kind == "toggle":
        return _toggle(children, depth)
    if kind == "captureEmbed":
        return _capture_embed(attrs)
    if kind in {"noteMention", "sourceMention", "text", "hardBreak"}:
        return _inline([node])
    return _unknown(node, children, depth)


def _unknown(node: dict, children: list[dict], depth: int) -> str:
    """Unknown node: keep its text, treating inline children as one line."""
    if not children:
        return _inline([node]) if node.get("type") == "text" else ""
    if all(_is_inline(child) for child in children):
        return _inline(children)
    return _blocks(children, depth + 1)


def _quote(text: str) -> str:
    return "\n".join(f"> {line}" if line else ">" for line in text.split("\n"))


def _toggle(children: list[dict], depth: int) -> str:
    summary = ""
    rest = children
    if children and children[0].get("type") == "toggleSummary":
        summary = _inline(_children(children[0]))
        rest = children[1:]
    inner = _blocks(rest, depth + 1)
    body = f"\n\n{inner}\n\n" if inner else "\n"
    return f"<details>\n<summary>{summary}</summary>{body}</details>"


def _capture_embed(attrs: dict) -> str:
    title = _str(attrs.get("title")) or "Untitled capture"
    kind = _str(attrs.get("sourceType"))
    stamp = attrs.get("timestampSec")
    label = f"📎 Capture: {title}"
    if kind:
        label += f" ({kind})"
    if isinstance(stamp, (int, float)) and not isinstance(stamp, bool):
        total = int(stamp)
        label += f" @ {total // 60}:{total % 60:02d}"
    return f"> {label}"


def _list(node: dict, depth: int) -> str:
    kind = node.get("type")
    start = _attrs(node).get("start")
    number = start if isinstance(start, int) else 1
    lines: list[str] = []
    for item in _children(node):
        if kind == "orderedList":
            marker = f"{number}."
            number += 1
        elif kind == "taskList" or item.get("type") == "taskItem":
            checked = _attrs(item).get("checked") is True
            marker = "- [x]" if checked else "- [ ]"
        else:
            marker = "-"
        lines.append(_list_item(item, marker, depth))
    return "\n".join(lines)


def _list_item(item: dict, marker: str, depth: int) -> str:
    blocks = [_block(child, depth + 1) for child in _children(item)]
    blocks = [block for block in blocks if block.strip()]
    if not blocks:
        return marker
    pad = " " * (len(marker) + 1)
    first, *rest = blocks
    first_lines = first.split("\n")
    out = [f"{marker} {first_lines[0]}"]
    out.extend(f"{pad}{line}" if line else "" for line in first_lines[1:])
    for block in rest:
        out.extend(f"{pad}{line}" if line else "" for line in block.split("\n"))
    return "\n".join(out)


def _table(rows: list[dict]) -> str:
    grid: list[list[str]] = []
    for row in rows:
        cells = [_cell_text(cell) for cell in _children(row)]
        if cells:
            grid.append(cells)
    if not grid:
        return ""
    width = max(len(row) for row in grid)
    grid = [row + [""] * (width - len(row)) for row in grid]
    lines = ["| " + " | ".join(grid[0]) + " |", "|" + " --- |" * width]
    lines.extend("| " + " | ".join(row) + " |" for row in grid[1:])
    return "\n".join(lines)


def _cell_text(cell: dict) -> str:
    text = " ".join(
        part for part in (_block(child, 1) for child in _children(cell)) if part.strip()
    )
    return text.replace("\n", " ").replace("|", "\\|")


# -------------------------------------------------------------------------- inline


def _inline(nodes: list[dict]) -> str:
    return "".join(_inline_node(node) for node in nodes)


def _inline_node(node: dict) -> str:
    kind = node.get("type")
    if kind == "text":
        return _apply_marks(_str(node.get("text")), node.get("marks"))
    if kind == "hardBreak":
        return "  \n"
    if kind == "noteMention":
        return f"[[{_str(_attrs(node).get('title'))}]]"
    if kind == "sourceMention":
        return f"@{_str(_attrs(node).get('title'))}"
    return _inline(_children(node))


def _apply_marks(text: str, marks: Any) -> str:
    if not text or not isinstance(marks, list):
        return text
    types = {mark.get("type"): mark for mark in marks if isinstance(mark, dict)}
    if "code" in types:
        return f"`{text}`"
    if "bold" in types:
        text = _wrap(text, "**")
    if "italic" in types:
        text = _wrap(text, "*")
    if "strike" in types:
        text = _wrap(text, "~~")
    if "highlight" in types:
        text = _wrap(text, "==")
    link = types.get("link")
    if link:
        href = _str(_attrs(link).get("href"))
        if href:
            text = f"[{text}]({href})"
    return text


def _wrap(text: str, token: str) -> str:
    """Wrap ``text`` in ``token``, keeping edge whitespace outside the markers."""
    stripped = text.strip()
    if not stripped:
        return text
    lead = text[: len(text) - len(text.lstrip())]
    tail = text[len(text.rstrip()) :]
    return f"{lead}{token}{stripped}{token}{tail}"
