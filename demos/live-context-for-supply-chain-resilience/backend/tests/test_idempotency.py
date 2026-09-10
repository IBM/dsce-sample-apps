# backend/tests/test_idempotency.py
# Unit tests for event idempotency (spec/10: idempotency, duplicate_shipment_event)

from __future__ import annotations
from app.core import idempotency


class TestIdempotency:
    def setup_method(self):
        idempotency.clear_all()

    def test_first_event_not_duplicate(self):
        assert not idempotency.is_duplicate("EVT-001")

    def test_marked_seen_is_duplicate(self):
        idempotency.mark_seen("EVT-001")
        assert idempotency.is_duplicate("EVT-001")

    def test_different_event_not_duplicate(self):
        idempotency.mark_seen("EVT-001")
        assert not idempotency.is_duplicate("EVT-002")

    def test_clear_removes_all(self):
        idempotency.mark_seen("EVT-001")
        idempotency.clear_all()
        assert not idempotency.is_duplicate("EVT-001")
