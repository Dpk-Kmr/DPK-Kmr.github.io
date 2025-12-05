document.addEventListener('DOMContentLoaded', () => {
  // Scroll Animation Observer
  const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('scroll-visible');
        observer.unobserve(entry.target); // Only animate once
      }
    });
  }, observerOptions);

  window.observeElements = (elements) => {
    elements.forEach(el => observer.observe(el));
  };

  const scrollElements = document.querySelectorAll('.scroll-hidden');
  window.observeElements(scrollElements);

  // Add scroll-hidden class to major sections if they don't have it
  // This is a helper to automatically animate sections without manually editing every HTML file
  const sections = document.querySelectorAll('section, .card, .hero-text, .hero-photo, .spotlight-card');
  sections.forEach(section => {
    if (!section.classList.contains('animate-fade-up')) { // Avoid conflict with existing animation class
       section.classList.add('scroll-hidden');
       observer.observe(section);
    }
  });
});
