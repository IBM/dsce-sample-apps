"""The read-only org MCP server: handshake, tool listing, calls, refusals."""
import json
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from headless_bob.org_mcp import OrgTools, make_router, mcp_config  # noqa: E402


class FakeMd:
    def describe_object(self, name): return {"name": name, "fields": [{"name": "Name", "type": "string"}]}
    def list_objects(self, custom_only=True): return [{"name": "Acme__c", "custom": True}] + ([] if custom_only else [{"name": "Account", "custom": False}])
    def list_flows(self): return [{"name": "F", "active": True}]
    def query(self, soql): return [{"Name": "row for " + soql}]


def app():
    a = FastAPI(); a.include_router(make_router(OrgTools(FakeMd()), token="t0k3n-secret-value")); return TestClient(a)


def rpc(c, body, **headers):
    return c.post("/mcp", content=json.dumps(body), headers={"Authorization": "Bearer t0k3n-secret-value",
                                                              "Accept": "application/json, text/event-stream", **headers})


def test_handshake_tools_and_calls():
    c = app()
    init = rpc(c, {"jsonrpc": "2.0", "id": 1, "method": "initialize",
                   "params": {"protocolVersion": "2025-03-26", "capabilities": {}, "clientInfo": {"name": "bob", "version": "2.0.4"}}})
    assert init.status_code == 200 and init.json()["result"]["capabilities"] == {"tools": {}}
    assert init.headers.get("mcp-session-id")
    assert rpc(c, {"jsonrpc": "2.0", "method": "notifications/initialized"}).status_code == 202
    tools = rpc(c, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}).json()["result"]["tools"]
    assert [t["name"] for t in tools] == ["describe_object", "list_objects", "list_flows", "query"]
    r = rpc(c, {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "describe_object", "arguments": {"name": "Acme__c"}}}).json()
    assert r["result"]["isError"] is False and json.loads(r["result"]["content"][0]["text"])["name"] == "Acme__c"
    r = rpc(c, {"jsonrpc": "2.0", "id": 4, "method": "tools/call", "params": {"name": "list_objects", "arguments": {"custom_only": False}}}).json()
    assert len(json.loads(r["result"]["content"][0]["text"])) == 2
    batch = rpc(c, [{"jsonrpc": "2.0", "id": 5, "method": "ping"}, {"jsonrpc": "2.0", "id": 6, "method": "tools/list"}]).json()
    assert [m["id"] for m in batch] == [5, 6]
    assert rpc(c, {"jsonrpc": "2.0", "id": 7, "method": "resources/list"}).json()["error"]["code"] == -32601


def test_query_is_select_only():
    c = app()
    ok = rpc(c, {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "query", "arguments": {"soql": "SELECT Name FROM Account LIMIT 5"}}}).json()
    assert ok["result"]["isError"] is False
    for bad in ("DELETE FROM Account", "SELECT Id FROM Account; DELETE", "UPDATE Account SET x=1", "SELECT Id FROM A /* hidden */"):
        r = rpc(c, {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "query", "arguments": {"soql": bad}}}).json()
        assert r["result"]["isError"] is True and "read-only" in r["result"]["content"][0]["text"]


def test_auth_origin_and_methods():
    c = app()
    body = {"jsonrpc": "2.0", "id": 1, "method": "ping"}
    assert c.post("/mcp", content=json.dumps(body)).status_code == 401                                   # no token
    assert c.post("/mcp", content=json.dumps(body), headers={"Authorization": "Bearer wrong"}).status_code == 401
    assert rpc(c, body, Origin="https://evil.example").status_code == 401                                 # browsers keep out
    assert rpc(c, body).status_code == 200
    assert c.get("/mcp", headers={"Authorization": "Bearer t0k3n-secret-value"}).status_code == 405       # no SSE stream offered
    assert c.delete("/mcp", headers={"Authorization": "Bearer t0k3n-secret-value", "Mcp-Session-Id": "x"}).status_code == 200
    assert c.post("/mcp", content="{not json", headers={"Authorization": "Bearer t0k3n-secret-value"}).status_code == 400


def test_mcp_config_shape():
    cfg = mcp_config("https://svc.example/mcp", "abc")
    assert cfg == {"mcpServers": {"salesforce-org": {"url": "https://svc.example/mcp", "transportType": "http",
                                                     "headers": {"Authorization": "Bearer abc"}, "timeout": 30000}}}
