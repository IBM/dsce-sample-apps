// ==================== DRAWERS ====================
function bindDrawer(options) {
  const trigger = document.getElementById(options.triggerId);
  const panel = document.getElementById(options.drawerId);
  const panelOverlay = document.getElementById(options.overlayId);
  const closeButton = document.getElementById(options.closeId);
  const cancelButton = options.cancelId ? document.getElementById(options.cancelId) : null;

  if (!trigger || !panel || !panelOverlay || !closeButton) return;

  function openDrawer() {
    panel.classList.add('is-open');
    panelOverlay.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-open');
  }

  function closeDrawer() {
    panel.classList.remove('is-open');
    panelOverlay.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-open');
  }

  trigger.addEventListener('click', openDrawer);
  closeButton.addEventListener('click', closeDrawer);
  panelOverlay.addEventListener('click', closeDrawer);

  if (cancelButton) {
    cancelButton.addEventListener('click', closeDrawer);
  }
}

bindDrawer({
  triggerId: 'demoExplainerBtn',
  drawerId: 'demoExplainerDrawer',
  overlayId: 'demoExplainerOverlay',
  closeId: 'demoExplainerClose'
});

const demoSectionNavLinks = Array.from(document.querySelectorAll('.demo-section-nav-link'));
const demoSections = demoSectionNavLinks
  .map((link) => {
    const targetId = link.getAttribute('href');
    if (!targetId || !targetId.startsWith('#')) {
      return null;
    }

    const section = document.querySelector(targetId);
    if (!section) {
      return null;
    }

    return { link, section };
  })
  .filter(Boolean);

if (demoSections.length > 0) {
  let hoverSuppressed = false;

  const setActiveDemoSection = (activeLink) => {
    demoSections.forEach(({ link }) => {
      const isActive = link === activeLink;
      link.classList.toggle('is-active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (hoverSuppressed) return;

      const visibleEntries = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

      if (visibleEntries.length === 0) {
        return;
      }

      const activeEntry = visibleEntries[0];
      const activeSection = demoSections.find(({ section }) => section === activeEntry.target);
      if (activeSection) {
        setActiveDemoSection(activeSection.link);
      }
    },
    {
      rootMargin: '-112px 0px -55% 0px',
      threshold: [0.2, 0.4, 0.6]
    }
  );

  demoSections.forEach(({ section }) => observer.observe(section));

  // Hover on a demo-step section activates matching nav item
  demoSections.forEach(({ link, section }) => {
    section.addEventListener('mouseenter', () => {
      hoverSuppressed = true;
      setActiveDemoSection(link);
    });
    section.addEventListener('mouseleave', () => {
      hoverSuppressed = false;
    });
  });
}
