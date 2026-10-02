"""The post-load replay filter: replayed prior replies are dropped, the new
answer is kept, and anything unexpected is kept rather than lost."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from bob_runtime.acp_runner import _ReplayFilter  # noqa: E402


def feed(f, events):
    out = []
    for kind, text in events:
        if kind == "user":
            f.user_chunk()
        else:
            out.append(f.agent_chunk(text))
    return "".join(out)


def test_two_prior_turns_are_dropped_and_the_answer_kept():
    f = _ReplayFilter(["Proposal text.", "Business impact answer."])
    assert feed(f, [("user", "case"), ("agent", "Proposal "), ("agent", "text."),
                    ("user", "impact?"), ("agent", "Business impact answer."),
                    ("agent", "Problem\n..."), ("agent", " Acceptance criteria")]) == "Problem\n... Acceptance criteria"


def test_a_chunk_that_crosses_into_the_new_answer_is_split():
    f = _ReplayFilter(["The sky is blue today."])
    assert feed(f, [("user", "q"), ("agent", "The sky is blue today.Grass is green.")]) == "Grass is green."


def test_unexpected_text_is_kept_not_lost():
    f = _ReplayFilter(["what we stored"])
    assert feed(f, [("user", "q"), ("agent", "what Bob actually replayed"), ("agent", " and the answer")]) \
        == "what Bob actually replayed and the answer"


def test_no_prior_replies_means_passthrough():
    f = _ReplayFilter([])
    assert feed(f, [("user", "q"), ("agent", "hello")]) == "hello"
