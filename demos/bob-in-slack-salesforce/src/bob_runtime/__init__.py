"""bob_runtime (ACP variant) — drives `bob acp` instead of `bob run`.

Public interface:

    from bob_runtime import BobRuntime, RunConfig

    rt = BobRuntime(root="/workspace", bob_bin="bob")
    first = rt.run("Hello", tenant="acme", session="slack-thread-42")
    reply = rt.run("And again?", tenant="acme", session="slack-thread-42",
                   resume=first.task_id)

Validated against bobshell 2.0.1; see docs/bob-shell-behavior.md.
"""

from .events import RunStats, StreamState
from .acp_runner import AcpBobRuntime as BobRuntime
from .runner import EXIT_TIMEOUT, RunConfig, RunResult
from .workspace import TenantWorkspace

__all__ = [
    "BobRuntime",
    "RunConfig",
    "RunResult",
    "RunStats",
    "StreamState",
    "TenantWorkspace",
    "EXIT_TIMEOUT",
]
