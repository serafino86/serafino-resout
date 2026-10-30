'use strict';

// Disclosure navigation: works with pointer, keyboard and touch.
const menuButton = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
if (menuButton && siteNav) {
  const closeMenu = (restoreFocus = false) => {
    siteNav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Ouvrir le menu');
    if (restoreFocus) menuButton.focus();
  };
  menuButton.addEventListener('click', () => {
    const open = siteNav.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
  });
  siteNav.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    closeMenu();
    if (link.hash && link.pathname === location.pathname) {
      const target = document.getElementById(link.hash.slice(1));
      if (target) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && siteNav.classList.contains('is-open')) closeMenu(true);
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header') && siteNav.classList.contains('is-open')) closeMenu();
  });
  matchMedia('(min-width: 861px)').addEventListener('change', () => closeMenu());
}

// A native modal keeps keyboard focus and background content isolated, including
// when focus enters the cross-origin assistant frame. No automatic interruption.
const assistantButton = document.getElementById('botFab');
const assistantDialog = document.getElementById('botPopup');
if (assistantButton && assistantDialog) {
  document.body.classList.add('has-chat');
  const frame = document.getElementById('botFrame');
  const closeButton = document.getElementById('botClose');
  let previousOverflow = '';
  assistantButton.addEventListener('click', () => {
    if (!frame.getAttribute('src')) frame.src = 'https://bot.serafino-resout.ch/?v=20261030audit1';
    previousOverflow = document.body.style.overflow;
    assistantDialog.showModal();
    document.body.style.overflow = 'hidden';
    assistantButton.setAttribute('aria-expanded', 'true');
    closeButton.focus();
  });
  closeButton.addEventListener('click', () => assistantDialog.close());
  assistantDialog.addEventListener('click', event => {
    if (event.target !== assistantDialog) return;
    const rect = assistantDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) assistantDialog.close();
  });
  assistantDialog.addEventListener('close', () => {
    assistantButton.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = previousOverflow;
    assistantButton.focus({ preventScroll: true });
  });
}
