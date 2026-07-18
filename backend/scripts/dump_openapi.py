"""Dump the FastAPI OpenAPI schema to backend/openapi.json.

This committed artifact is the contract the extension generates its TS types
from, so CI can run ``openapi-typescript`` without a live server. Run:

    python scripts/dump_openapi.py

CI diffs the result against the committed file to catch drift.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow running as a script (python scripts/dump_openapi.py) from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app  # noqa: E402

OUTPUT = Path(__file__).resolve().parent.parent / "openapi.json"


def main() -> None:
    schema = app.openapi()
    OUTPUT.write_text(json.dumps(schema, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
