"""A minimal trigger page for the sample: GET /demo shows a form, POST
/demo/case creates the Salesforce case and the Slack channel. In a real
integration the trigger is whatever creates cases in your org; this page
exists so the flow can be started from a browser with nothing else installed."""

KIOSK_HTML = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bob in Slack — start a case</title>
<style>
  body { font-family: -apple-system, "IBM Plex Sans", Segoe UI, sans-serif; margin: 0; background: #f4f4f4; color: #161616; }
  main { max-width: 640px; margin: 48px auto; padding: 0 20px; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; }
  p.lead { color: #525252; margin: 0 0 24px; }
  textarea { width: 100%; min-height: 160px; padding: 12px; font: inherit; border: 1px solid #8d8d8d; border-radius: 4px; box-sizing: border-box; }
  button { margin-top: 12px; padding: 12px 20px; font: inherit; background: #0f62fe; color: #fff; border: 0; border-radius: 4px; cursor: pointer; }
  button:disabled { background: #8d8d8d; }
  .err { color: #da1e28; }
  #done { display: none; }
  code { background: #e0e0e0; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<main>
  <h1>Start a case for Bob</h1>
  <p class="lead">Describe a Salesforce request, or leave the sample story. A case is created in the org and Bob picks it up in a new Slack channel.</p>
  <div id="form">
    <textarea id="issue"></textarea>
    <button id="go" onclick="submitCase()">Create case</button>
    <p class="err" id="err"></p>
  </div>
  <div id="done">
    <h2>Case created</h2>
    <p id="caseinfo"></p>
    <p><a id="slacklink" href="#" target="_blank" rel="noopener">Open the case channel in Slack</a></p>
  </div>
</main>
<script>
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
async function submitCase() {
  const go = document.getElementById('go'); const err = document.getElementById('err');
  go.disabled = true; err.textContent = '';
  try {
    const res = await fetch('/demo/case', {method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({issue: document.getElementById('issue').value})});
    if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
    const data = await res.json();
    document.getElementById('caseinfo').innerHTML = 'Case <code>' + escHtml(data.caseNumber) + '</code> · channel <code>#' + escHtml(data.channel) + '</code>';
    const cur = await (await fetch('/demo/current')).json();
    const link = document.getElementById('slacklink');
    if (cur.url) { link.href = cur.url; } else { link.textContent = 'Open Slack and find #' + data.channel; link.removeAttribute('href'); }
    document.getElementById('form').style.display = 'none';
    document.getElementById('done').style.display = 'block';
  } catch (e) { err.textContent = 'Could not create the case: ' + e.message; go.disabled = false; }
}
</script>
</body>
</html>
"""
