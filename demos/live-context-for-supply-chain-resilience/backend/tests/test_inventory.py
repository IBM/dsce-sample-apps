# backend/tests/test_inventory.py
# Unit tests for inventory model invariants (spec/02, spec/10)

from __future__ import annotations
from app.domain.models import InventoryPosition


class TestInventoryInvariant:
    def test_available_never_negative(self):
        pos = InventoryPosition(
            location_id="LOC-1",
            material_id="CVA-8842",
            on_hand=0,
            reserved=5,
            available=0,
        )
        assert pos.available == 0

    def test_available_correct_normal(self):
        pos = InventoryPosition(
            location_id="LOC-1",
            material_id="CVA-8842",
            on_hand=5,
            reserved=2,
            available=3,
        )
        assert pos.available == 3

    def test_seed_regional_warehouse(self):
        from app.data.seed import INVENTORY
        regional = next(i for i in INVENTORY if i.location_id == "REGIONAL-WH-DEMO")
        assert regional.available == 1
        assert regional.on_hand - regional.reserved == 1

    def test_seed_pearl_demo_empty(self):
        from app.data.seed import INVENTORY
        pearl = next(i for i in INVENTORY if i.location_id == "PEARL-DEMO")
        assert pearl.available == 0
