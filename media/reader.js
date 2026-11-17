(() => {
  const vscode = acquireVsCodeApi();
  const state = {
    fontSize: Number(sessionStorage.getItem('reader-font-size')) || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--reader-font-size')) || 17,
    width: sessionStorage.getItem('reader-width') || document.documentElement.dataset.width || 'comfortable',
    tocOpen: sessionStorage.getItem('reader-toc-open') !== 'false'
  };
  const widths = ['narrow', 'comfortable', 'wide'];
  const toc = document.getElementById('toc');
  const topButton = document.getElementById('back-to-top');

  function applyState() {
    document.documentElement.style.setProperty('--reader-font-size', `${state.fontSize}px`);
    document.documentElement.dataset.width = state.width;
    if (toc) toc.classList.toggle('collapsed', !state.tocOpen);
  }

  document.getElementById('font-down')?.addEventListener('click', () => {
    state.fontSize = Math.max(12, state.fontSize - 1);
    sessionStorage.setItem('reader-font-size', String(state.fontSize));
    applyState();
  });

  document.getElementById('font-up')?.addEventListener('click', () => {
    state.fontSize = Math.min(28, state.fontSize + 1);
    sessionStorage.setItem('reader-font-size', String(state.fontSize));
    applyState();
  });

  document.getElementById('width-toggle')?.addEventListener('click', () => {
    const nextIndex = (widths.indexOf(state.width) + 1) % widths.length;
    state.width = widths[nextIndex];
    sessionStorage.setItem('reader-width', state.width);
    applyState();
  });

  document.getElementById('toc-toggle')?.addEventListener('click', () => {
    state.tocOpen = !state.tocOpen;
    sessionStorage.setItem('reader-toc-open', String(state.tocOpen));
    applyState();
  });

  function bindAnchorLinks() {
    document.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const target = document.getElementById(link.getAttribute('href').slice(1));
        if (target) {
          event.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  window.addEventListener('message', (event) => {
    if (event.data?.type !== 'update') return;
    const body = document.getElementById('markdown-body');
    const tocLinks = document.getElementById('toc-links');
    const title = document.getElementById('file-title');
    if (body) body.innerHTML = event.data.html;
    if (tocLinks) tocLinks.innerHTML = event.data.tocHtml;
    if (title) title.textContent = event.data.title;
    document.title = event.data.title;
    document.getElementById('toc-toggle')?.classList.toggle('hidden', !event.data.tocHtml || document.documentElement.dataset.showToc === 'false');
    bindAnchorLinks();
  });

  window.addEventListener('scroll', () => {
    topButton?.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });

  topButton?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  bindAnchorLinks();
  applyState();
  vscode.postMessage({ type: 'ready' });
})();
