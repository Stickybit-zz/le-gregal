document.querySelector('.nav-toggle').addEventListener('click', function() {
  const nav = document.querySelector('.site-nav');
  const expanded = this.getAttribute('aria-expanded') === 'true';
  this.setAttribute('aria-expanded', !expanded);
  nav.classList.toggle('open');
});
