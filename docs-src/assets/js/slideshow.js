(() => {
  const INTERVAL_MS = 5000;

  document.querySelectorAll('.demo-detail-column-right').forEach(wrap => {
    const slideshow = wrap.querySelector('.demo-slideshow');
    const slides = slideshow.querySelectorAll('.demo-slide');
    if (slides.length <= 1) return;

    const dots = wrap.querySelectorAll('.demo-slide-dot');
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

    wrap.querySelector('.demo-slide-prev').addEventListener('click', () => {
      goTo(current - 1);
      startTimer();
    });

    wrap.querySelector('.demo-slide-next').addEventListener('click', () => {
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
})();
