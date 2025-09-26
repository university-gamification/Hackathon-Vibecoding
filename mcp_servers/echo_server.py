import json
import sys
from typing import Any, Dict

"""
A minimal JSON-RPC style stdio loop you can adapt for MCP.
This is intentionally lightweight and framework-agnostic.

Protocol (simplified):
- Read a line of JSON from stdin
- Expect an object with fields: {"id": <id>, "method": <name>, "params": {...}}
- Write a JSON response {"id": <id>, "result": <any>} or {"id": <id>, "error": {"message": str}}

Methods implemented:
- list_tools: returns a static list of example tools
- call_tool: { name: "echo", args: { text: "..." } } -> echoes back
"""

TOOLS = [
    {
        "name": "echo",
        "description": "Echo back the provided text",
        "args": {"text": "string"},
    }
]


def handle_request(req: Dict[str, Any]) -> Dict[str, Any]:
    _id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    try:
        if method == "list_tools":
            return {"id": _id, "result": TOOLS}
        elif method == "call_tool":
            name = params.get("name")
            args = params.get("args", {})
            if name == "echo":
                text = args.get("text", "")
                return {"id": _id, "result": {"text": text}}
            else:
                raise ValueError(f"Unknown tool: {name}")
        else:
            raise ValueError(f"Unknown method: {method}")
    except Exception as e:  # noqa: BLE001
        return {"id": _id, "error": {"message": str(e)}}


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            sys.stdout.write(json.dumps({"id": None, "error": {"message": f"Invalid JSON: {e}"}}) + "\n")
            sys.stdout.flush()
            continue

        resp = handle_request(req)
        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
