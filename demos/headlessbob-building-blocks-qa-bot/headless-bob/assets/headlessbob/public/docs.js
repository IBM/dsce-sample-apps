'use strict';
for (const pre of document.querySelectorAll('.api-document pre')) {
  const wrapper = document.createElement('div'); wrapper.className = 'docs-code';
  pre.before(wrapper); wrapper.append(pre);
  const button = document.createElement('button'); button.className = 'button outline docs-copy'; button.textContent = 'Copy'; button.type = 'button';
  button.setAttribute('aria-label', 'Copy code example');
  button.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(pre.textContent); button.textContent = 'Copied'; }
    catch { button.textContent = 'Select text to copy'; }
    setTimeout(() => { button.textContent = 'Copy'; }, 2000);
  });
  wrapper.append(button);
}
