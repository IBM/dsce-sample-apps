(() => {
  const INTERVAL_MS = 5000;
  const demoMeta = window.__DSCE_DEMO__ || {};

  function segmentTrack(event, props) {
    if (window.analytics) {
      window.analytics.track(event, Object.assign(
        { demo_name: demoMeta.name, demo_slug: demoMeta.slug, productCodeType: 'ibm build engineering', productCode: 'dsce2' },
        props
      ));
    }
  }

  document.querySelectorAll('.demo-slideshow').forEach(slideshow => {
    const slides = slideshow.querySelectorAll('.demo-slide');
    if (slides.length <= 1) return;

    const dots = slideshow.querySelectorAll('.demo-slide-dot');
    let current = 0;
    let timer;

    function goTo(index) {
      slides[current].classList.remove('is-active');
      dots[current].classList.remove('is-active');
      current = (index + slides.length) % slides.length;
      slides[current].classList.add('is-active');
      dots[current].classList.add('is-active');
    }

    function startTimer() {
      clearInterval(timer);
      timer = setInterval(() => goTo(current + 1), INTERVAL_MS);
    }

    slideshow.querySelector('.demo-slide-prev').addEventListener('click', () => {
      goTo(current - 1);
      startTimer();
    });

    slideshow.querySelector('.demo-slide-next').addEventListener('click', () => {
      goTo(current + 1);
      startTimer();
    });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        goTo(i);
        startTimer();
      });
    });

    startTimer();
  });

  // Lightbox
  const lightbox = document.getElementById('demoLightbox');
  if (!lightbox) return;

  const lightboxImg = document.getElementById('demoLightboxImg');
  const lightboxClose = document.getElementById('demoLightboxClose');

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.hidden = false;
    lightboxClose.focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = '';
  }

  document.querySelectorAll('.demo-slide-zoom').forEach(btn => {
    btn.addEventListener('click', () => {
      openLightbox(btn.dataset.src, btn.dataset.alt);
      const alt = btn.dataset.alt || '';
      const imageType = alt.includes('architecture') ? 'architecture'
        : alt.includes('specifications') ? 'specifications-workflow'
        : 'screenshot';
      segmentTrack('UI Interaction', {
        channel: 'webpage',
        namespace: 'slideshow',
        CTA: 'Screenshot Expanded',
        elementId: 'demo-slide-zoom',
        platformTitle: 'DSCE',
        payload: { image_type: imageType, image_alt: alt }
      });
    });
  });

  lightboxClose.addEventListener('click', closeLightbox);

  // Close on backdrop click (not on the image itself)
  lightbox.addEventListener('click', e => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
  });

  // Video playback tracking (IBM-Common: Video Playback Started / Completed)
  document.querySelectorAll('video').forEach(video => {
    let started = false;

    function videoProps() {
      return {
        title: demoMeta.name || document.title,
        videoTitle: demoMeta.name || document.title,
        videoPlayer: 'html5',
        totalLength: isFinite(video.duration) ? Math.round(video.duration) : null,
        position: Math.round(video.currentTime || 0)
      };
    }

    video.addEventListener('play', () => {
      if (!started) {
        started = true;
        segmentTrack('Video Playback Started', videoProps());
      }
    });

    video.addEventListener('ended', () => {
      segmentTrack('Video Playback Completed', Object.assign(videoProps(), {
        position: isFinite(video.duration) ? Math.round(video.duration) : 0
      }));
    });
  });
})();
