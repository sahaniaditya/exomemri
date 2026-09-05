"""Numbered catalogs in a source become topic names, not LLM-invented labels."""

from __future__ import annotations

from app.services.pipeline.catalog import topics_from_source_catalog


def test_catalog_uses_numbered_names_from_the_source() -> None:
    extract = """
assistant: Common code design smells are warning signs.

1. God Object / God Class

One class does too much. Split into UserService, AuthService, and EmailService.

2. Long Method

A function becomes very large and handles many different steps in checkout.

3. Feature Envy

A method uses another object's data more than its own, so move the logic closer.

4. Primitive Obsession

Using primitive types where a meaningful domain object would be clearer.
"""
    names = [topic.name for topic in topics_from_source_catalog(extract)]
    assert names == [
        "God Object / God Class",
        "Long Method",
        "Feature Envy",
        "Primitive Obsession",
    ]
    assert "UserService" in topics_from_source_catalog(extract)[0].description
    assert "Rigid code" not in names
    assert "Fragile code" not in names


def test_catalog_ignores_a_restarted_shorter_list() -> None:
    extract = """
1. God Object / God Class

One class does too much and should be split into smaller services.

2. Long Method

A function becomes very large and handles many different checkout steps.

3. Large Class

A class has too many fields and methods hiding multiple responsibilities.

4. Feature Envy

A method uses another object's data more than its own in calculateDiscount.

1. Changes become expensive

Imagine swapping PostgreSQL for MongoDB and having to edit business logic.
"""
    names = [topic.name for topic in topics_from_source_catalog(extract)]
    assert names[0] == "God Object / God Class"
    assert "Changes become expensive" not in names


def test_catalog_returns_empty_when_there_is_no_numbered_list() -> None:
    assert topics_from_source_catalog("A short note about batteries.") == []
