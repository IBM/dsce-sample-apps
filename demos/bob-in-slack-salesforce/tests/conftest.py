import pytest


@pytest.fixture(autouse=True)
def _fake_bob_env_passthrough(monkeypatch):
    """The fake Bob agents are steered through FAKE_BOB_* variables; the
    runtime's environment allowlist would strip them, so tests opt them in the
    same way a deployment would opt in its own names."""
    monkeypatch.setenv("HB_BOB_ENV_EXTRA", "FAKE_BOB_*")
