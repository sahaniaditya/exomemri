"""Pure TipTap helpers: plain text, link extraction and Markdown export."""

from __future__ import annotations

import pytest

from app.services.note_text import extract_links, extract_text, to_markdown

SRC = "11111111-1111-4111-8111-111111111111"
NOTE = "22222222-2222-4222-8222-222222222222"


def doc(*blocks: dict) -> dict:
    return {"type": "doc", "content": list(blocks)}


def p(*inline: dict) -> dict:
    return {"type": "paragraph", "content": list(inline)}


def t(text: str, *marks: str | dict) -> dict:
    node: dict = {"type": "text", "text": text}
    if marks:
        node["marks"] = [m if isinstance(m, dict) else {"type": m} for m in marks]
    return node


def md(*blocks: dict, title: str | None = None) -> str:
    return to_markdown(doc(*blocks), title)


# ------------------------------------------------------------------ markdown


def test_empty_and_malformed_documents_never_raise() -> None:
    assert to_markdown({}) == "\n"
    assert to_markdown(None) == "\n"
    assert to_markdown("nope") == "\n"
    assert to_markdown({"type": "doc", "content": "bad"}) == "\n"
    assert to_markdown({"type": "doc", "content": [None, 3, "x"]}) == "\n"
    assert extract_text(None) == ""
    assert extract_links(42) == []


def test_title_becomes_h1() -> None:
    assert md(p(t("hi")), title="  My note ") == "# My note\n\nhi\n"


def test_paragraphs_and_marks() -> None:
    out = md(
        p(
            t("bold", "bold"),
            t(" "),
            t("ital", "italic"),
            t(" "),
            t("code", "code"),
            t(" "),
            t("gone", "strike"),
            t(" "),
            t("mark", {"type": "highlight", "attrs": {"color": "yellow"}}),
            t(" "),
            t("site", {"type": "link", "attrs": {"href": "https://x.dev"}}),
        )
    )
    assert out == "**bold** *ital* `code` ~~gone~~ ==mark== [site](https://x.dev)\n"


def test_bold_italic_combo_and_edge_whitespace() -> None:
    assert md(p(t("a"), t(" both ", "bold", "italic"), t("c"))) == "a ***both*** c\n"


def test_hard_break_and_unmarked_textstyle() -> None:
    styled = t("b", {"type": "textStyle", "attrs": {"color": "red"}})
    out = md(p(t("a"), {"type": "hardBreak"}, styled))
    assert out == "a  \nb\n"


@pytest.mark.parametrize("level,prefix", [(1, "#"), (2, "##"), (3, "###")])
def test_headings(level: int, prefix: str) -> None:
    node = {"type": "heading", "attrs": {"level": level}, "content": [t("Head")]}
    assert md(node) == f"{prefix} Head\n"


def test_heading_with_bad_level_falls_back_to_h1() -> None:
    assert md({"type": "heading", "attrs": {"level": "x"}, "content": [t("H")]}) == "# H\n"


def test_nested_bullet_and_ordered_lists() -> None:
    inner = {
        "type": "orderedList",
        "content": [
            {"type": "listItem", "content": [p(t("one"))]},
            {"type": "listItem", "content": [p(t("two"))]},
        ],
    }
    outer = {
        "type": "bulletList",
        "content": [
            {"type": "listItem", "content": [p(t("top")), inner]},
            {"type": "listItem", "content": [p(t("second"))]},
        ],
    }
    assert md(outer) == "- top\n  1. one\n  2. two\n- second\n"


def test_ordered_list_respects_start() -> None:
    node = {
        "type": "orderedList",
        "attrs": {"start": 4},
        "content": [{"type": "listItem", "content": [p(t("x"))]}],
    }
    assert md(node) == "4. x\n"


def test_task_list_with_nesting() -> None:
    node = {
        "type": "taskList",
        "content": [
            {
                "type": "taskItem",
                "attrs": {"checked": True},
                "content": [
                    p(t("done")),
                    {
                        "type": "taskList",
                        "content": [
                            {
                                "type": "taskItem",
                                "attrs": {"checked": False},
                                "content": [p(t("sub"))],
                            }
                        ],
                    },
                ],
            },
            {"type": "taskItem", "attrs": {"checked": False}, "content": [p(t("todo"))]},
        ],
    }
    assert md(node) == "- [x] done\n      - [ ] sub\n- [ ] todo\n"


def test_blockquote_code_rule_image() -> None:
    out = md(
        {"type": "blockquote", "content": [p(t("quoted")), p(t("more"))]},
        {"type": "codeBlock", "attrs": {"language": "py"}, "content": [t("print(1)")]},
        {"type": "horizontalRule"},
        {"type": "image", "attrs": {"key": "notes/images/a.png"}},
    )
    assert out == (
        "> quoted\n>\n> more\n\n```py\nprint(1)\n```\n\n---\n\n![image](notes/images/a.png)\n"
    )


def test_code_block_without_language() -> None:
    assert md({"type": "codeBlock", "content": [t("x")]}) == "```\nx\n```\n"


def test_table_with_header_row_and_ragged_rows() -> None:
    def cell(kind: str, text: str) -> dict:
        return {"type": kind, "content": [p(t(text))]}

    table = {
        "type": "table",
        "content": [
            {"type": "tableRow", "content": [cell("tableHeader", "A"), cell("tableHeader", "B")]},
            {"type": "tableRow", "content": [cell("tableCell", "1"), cell("tableCell", "x|y")]},
            {"type": "tableRow", "content": [cell("tableCell", "2")]},
        ],
    }
    assert md(table) == "| A | B |\n| --- | --- |\n| 1 | x\\|y |\n| 2 |  |\n"


def test_empty_table_renders_nothing() -> None:
    assert md({"type": "table", "content": []}) == "\n"


def test_callout_renders_as_emoji_quote() -> None:
    node = {
        "type": "callout",
        "attrs": {"emoji": "🔥", "variant": "warning"},
        "content": [p(t("careful")), p(t("really"))],
    }
    assert md(node) == "> 🔥 careful\n>\n> really\n"


def test_callout_defaults_emoji() -> None:
    assert md({"type": "callout", "content": [p(t("hi"))]}) == "> 💡 hi\n"


def test_toggle_renders_details() -> None:
    node = {
        "type": "toggle",
        "attrs": {"open": True},
        "content": [{"type": "toggleSummary", "content": [t("More")]}, p(t("hidden"))],
    }
    assert md(node) == "<details>\n<summary>More</summary>\n\nhidden\n\n</details>\n"


def test_toggle_without_body() -> None:
    node = {"type": "toggle", "content": [{"type": "toggleSummary", "content": [t("S")]}]}
    assert md(node) == "<details>\n<summary>S</summary>\n</details>\n"


def test_capture_embed_with_timestamp() -> None:
    node = {
        "type": "captureEmbed",
        "attrs": {
            "sourceId": SRC,
            "title": "Intro talk",
            "sourceType": "youtube",
            "timestampSec": 125,
        },
    }
    assert md(node) == "> 📎 Capture: Intro talk (youtube) @ 2:05\n"


def test_capture_embed_without_timestamp_or_title() -> None:
    node = {"type": "captureEmbed", "attrs": {"sourceId": SRC, "timestampSec": None}}
    assert md(node) == "> 📎 Capture: Untitled capture\n"


def test_mentions_inline() -> None:
    out = md(
        p(
            t("see "),
            {"type": "noteMention", "attrs": {"noteId": NOTE, "title": "Other page"}},
            t(" and "),
            {"type": "sourceMention", "attrs": {"sourceId": SRC, "title": "Video"}},
        )
    )
    assert out == "see [[Other page]] and @Video\n"


def test_unknown_block_degrades_to_children_text() -> None:
    node = {"type": "futureWidget", "content": [p(t("kept")), p(t("also"))]}
    assert md(node) == "kept\n\nalso\n"


def test_unknown_node_with_inline_children_and_unknown_leaf() -> None:
    out = md({"type": "mystery", "content": [t("a"), t("b", "bold")]}, {"type": "alien"})
    assert out == "a**b**\n"


def test_unknown_inline_inside_paragraph_keeps_text() -> None:
    out = md(p(t("x"), {"type": "emoji", "content": [t(":)")]}))
    assert out == "x:)\n"


def test_deeply_nested_document_does_not_raise() -> None:
    node: dict = p(t("leaf"))
    for _ in range(200):
        node = {"type": "blockquote", "content": [node]}
    assert isinstance(to_markdown(doc(node)), str)
    assert isinstance(extract_text(doc(node)), str)
    assert extract_links(doc(node)) == []


# --------------------------------------------------------------------- text


def test_extract_text_separates_blocks_and_includes_atoms() -> None:
    d = doc(
        {"type": "heading", "attrs": {"level": 1}, "content": [t("Title")]},
        p(t("hello "), t("world", "bold"), {"type": "hardBreak"}, t("again")),
        {"type": "bulletList", "content": [{"type": "listItem", "content": [p(t("item"))]}]},
        {"type": "captureEmbed", "attrs": {"sourceId": SRC, "title": "Talk"}},
        p({"type": "noteMention", "attrs": {"noteId": NOTE, "title": "Page"}}),
        {"type": "codeBlock", "content": [t("x = 1")]},
        {"type": "futureWidget", "content": [t("raw")]},
        {
            "type": "toggle",
            "content": [{"type": "toggleSummary", "content": [t("sum")]}, p(t("body"))],
        },
    )
    assert extract_text(d) == (
        "Title\nhello world\nagain\nitem\nTalk\nPage\nx = 1\nraw\nsum\nbody"
    )


def test_extract_text_is_capped() -> None:
    big = doc(p(t("x" * 300_000)))
    assert len(extract_text(big)) == 200_000


# --------------------------------------------------------------------- links


def test_extract_links_dedupes_and_validates() -> None:
    d = doc(
        {"type": "captureEmbed", "attrs": {"sourceId": SRC, "title": "a"}},
        p(
            {"type": "sourceMention", "attrs": {"sourceId": SRC.upper(), "title": "a"}},
            {"type": "noteMention", "attrs": {"noteId": NOTE, "title": "n"}},
            {"type": "noteMention", "attrs": {"noteId": "not-a-uuid", "title": "bad"}},
            {"type": "noteMention", "attrs": {"title": "missing id"}},
        ),
        {"type": "bulletList", "content": [{"type": "listItem", "content": [
            {"type": "captureEmbed", "attrs": {"sourceId": "33333333-3333-4333-8333-333333333333"}}
        ]}]},
    )
    assert extract_links(d) == [
        ("source", SRC),
        ("note", NOTE),
        ("source", "33333333-3333-4333-8333-333333333333"),
    ]
