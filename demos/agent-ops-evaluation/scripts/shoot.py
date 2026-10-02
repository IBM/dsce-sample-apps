"""Drive the running app in headless Chromium and screenshot every page after real runs.
Usage: python scripts/shoot.py [base_url]   (needs playwright + chromium in the interpreter)"""
import sys
from playwright.sync_api import sync_playwright

base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
out = "results/shots"

def run_panel(pg, path, label, idx, timeout_ms):
    pg.goto(base + path); pg.wait_for_timeout(800)
    buttons = pg.locator("button", has_text="Run now").or_(pg.locator("button", has_text="Run again")).all()
    if idx < len(buttons):
        buttons[idx].click()
        pg.wait_for_function("() => !document.body.innerText.includes('Running…')", timeout=timeout_ms)
        pg.wait_for_timeout(600)
    pg.screenshot(path=f"{out}/{label}.png", full_page=True)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=2)
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "404" not in m.text else None)

    pg.goto(base + "/overview"); pg.wait_for_selector("text=Agents in this demo"); pg.screenshot(path=f"{out}/01-overview.png", full_page=True)

    pg.goto(base + "/run"); pg.wait_for_selector("text=Submit an application")
    pg.get_by_text("Marcus Reyes").first.click()
    pg.wait_for_selector("text=decision APPROVED", timeout=120_000)
    pg.wait_for_timeout(400); pg.screenshot(path=f"{out}/02-run-v1-marcus.png", full_page=True)
    pg.wait_for_function("() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('Load platform trace')); return b && !b.disabled }", timeout=60_000)
    pg.get_by_role("button", name="Load platform trace").click()
    pg.wait_for_selector("text=end to end", timeout=60_000); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{out}/03-run-v1-trace.png", full_page=True)

    run_panel(pg, "/evaluate", "04-evaluate-v1", 0, 240_000)
    pg.wait_for_timeout(21_000)                       # start cooldown between jobs
    run_panel(pg, "/evaluate", "05-evaluate-both", 1, 240_000)
    fails = pg.get_by_text("fail", exact=True).all()
    if fails:
        fails[0].click(); pg.wait_for_timeout(500); pg.screenshot(path=f"{out}/06-evaluate-case.png", full_page=True)
    pg.locator("button", has_text="analyze").first.click()
    pg.wait_for_selector("text=Overall Summary", timeout=180_000); pg.wait_for_timeout(300)
    pg.screenshot(path=f"{out}/07-evaluate-analyze.png", full_page=True)

    pg.wait_for_timeout(21_000)
    run_panel(pg, "/rubric", "08-rubric-v1", 0, 240_000)
    pg.wait_for_timeout(21_000)
    run_panel(pg, "/red-team", "09-redteam-v1", 0, 300_000)
    pg.get_by_text("Show the conversation").first.click(); pg.wait_for_timeout(400)
    pg.screenshot(path=f"{out}/10-redteam-conversation.png", full_page=True)
    print("console/page errors:", errors or "none")
    b.close()
