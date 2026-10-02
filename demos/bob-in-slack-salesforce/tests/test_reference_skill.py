"""The sf-metadata-reference skill: every example is a file the package
pipeline accepts, and the prompts send Bob to it."""
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from headless_bob import package_artifact as pa  # noqa: E402
from headless_bob.caseflow import _build_prompt, _fix_prompt  # noqa: E402
from verify_reference import SKILL_DIR, examples, write_workspace  # noqa: E402


def test_every_example_is_a_deployable_component(tmp_path):
    files = examples()
    assert len(files) >= 10, sorted(files)
    for rel, content in files.items():
        if rel.endswith(".xml"):
            ET.fromstring(content)                       # well-formed, declaration first
            assert content.startswith("<?xml"), rel
    write_workspace(tmp_path, files)
    pkg = pa.collect(tmp_path)
    assert pkg.problems == []
    assert set(pkg.members) == {"Flow", "CustomField", "ValidationRule", "ApexClass"}
    assert pkg.apex_tests == ["Ref_OpportunityServiceTest"]
    assert all(n.startswith("Ref_") or n.split(".")[-1].startswith("Ref_") for names in pkg.members.values() for n in names)


def test_skill_front_matter_and_index():
    skill = (SKILL_DIR / "SKILL.md").read_text()
    assert skill.startswith("---\nname: sf-metadata-reference\n")
    for doc in ("flow.md", "custom-field.md", "validation-rule.md", "apex-class.md"):
        assert f"`{doc}`" in skill and (SKILL_DIR / doc).is_file()


def test_prompts_send_bob_to_the_reference():
    class Stub:
        package_types = pa.ALLOWED_TYPES
    build = _build_prompt(Stub(), {"case_number": "00001234", "issue": "x", "proposal": "y"})
    assert "sf-metadata-reference" in build and "ending its name with _1234" in build
    assert "sf-metadata-reference" in _fix_prompt(Stub(), ["flows/X.flow line 3: bad"])
