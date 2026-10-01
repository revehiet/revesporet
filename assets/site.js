'use strict';

// Retain preferences saved by the original site.
const themeToggle = document.getElementById('nightToggle');
function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.setAttribute('aria-label', dark ? 'Slå på lys modus' : 'Slå på mørk modus');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#191d19' : '#f5f4ef';
}
themeToggle.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  try { localStorage.setItem('nightMode', dark ? '1' : '0'); } catch {}
  syncTheme();
});
syncTheme();
document.getElementById('year').textContent = new Date().getFullYear();

const menuToggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('main-nav');
function closeMenu() {
  nav.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
  menuToggle.setAttribute('aria-label', 'Åpne meny');
}
menuToggle.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'Lukk meny' : 'Åpne meny');
});
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); menuToggle.focus(); }
});
const navLinks = Array.from(nav.querySelectorAll('a'));
const navSections = navLinks.map(link => document.querySelector(link.getAttribute('href')));
let scrollPending = false;
function syncNavigation() {
  let active = 0;
  navSections.forEach((section, index) => {
    if (section.getBoundingClientRect().top <= innerHeight * .35) active = index;
  });
  navLinks.forEach((link, index) => {
    link.classList.toggle('active', index === active);
    if (index === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  scrollPending = false;
}
window.addEventListener('scroll', () => {
  if (!scrollPending) { scrollPending = true; requestAnimationFrame(syncNavigation); }
}, { passive: true });
window.addEventListener('resize', syncNavigation);
syncNavigation();

const image = (file, title) => ({ type: 'image', src: `assets/images/${file}.webp`, preview: `assets/images/previews/${file}.webp`, title });
const film = (file, title) => ({ type: 'video', src: `assets/videos/${file}/index.m3u8`, fallback: `assets/videos/${file}.webm`, preview: `assets/images/posters/${file}.webp`, title });
const projects = {
  sunlit: { title: 'Sunlit Sea', category: '3D & ANIMASJON', items: [image('1', 'Flytende solenergi / 01'), image('2', 'Flytende solenergi / 02'), image('3', 'Flytende solenergi / 03'), image('4', 'Flytende solenergi / 04'), film('Scene1', 'Animasjon / 01'), film('Scene2', 'Animasjon / 02')] },
  purepipe: { title: 'PurePipe', category: 'PRODUKTVISUALISERING', items: [image('p_1', 'Produktvisualisering / 01'), image('p_2', 'Produktvisualisering / 02'), image('p_4', 'Produktvisualisering / 03'), film('P1', 'Animasjon / 01'), film('P2', 'Animasjon / 02'), film('P3', 'Animasjon / 03')] },
  surewave: { title: 'SureWave', category: '3D & ANIMASJON', items: [image('sure_1', 'Visualisering / 01'), image('sure_2', 'Visualisering / 02'), image('sure_3', 'Visualisering / 03'), image('sure_4', 'Visualisering / 04'), film('W1', 'Animasjon / 01'), film('W2', 'Animasjon / 02'), film('W3', 'Animasjon / 03')] },
  salmon: { title: 'Salmon Solutions UB', category: 'MARIN TEKNOLOGI', items: [image('s_1', 'Havbruk / 01'), image('s_2', 'Havbruk / 02'), image('s_3', 'Havbruk / 03')] },
  trawltech: { title: 'TrawlTech UB', category: 'MARIN TEKNOLOGI', items: [image('trawl_3', 'Marin teknologi / 01'), image('trawl_1', 'Marin teknologi / 02'), image('trawl_4', 'Marin teknologi / 03')] }
};
const reels = Array.from({ length: 6 }, (_, index) => {
  const number = index + 1;
  return { type: 'video', src: `assets/videos/reels/reel%20${number}/index.m3u8`, fallback: `assets/videos/reels/reel%20${number}.mp4`, preview: `assets/images/posters/reel-${number}.webp`, title: `Reel 0${number}` };
});

const dialog = document.getElementById('media-dialog');
const stage = document.getElementById('viewer-stage');
const thumbnails = document.getElementById('viewer-thumbnails');
const errorMessage = document.getElementById('media-error');
const previous = dialog.querySelector('.viewer-prev');
const next = dialog.querySelector('.viewer-next');
let selection = null;
let currentIndex = 0;
let hls = null;
let activeVideo = null;
let opener = null;
let mediaGeneration = 0;

const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const hoverPreference = matchMedia('(hover: hover) and (pointer: fine)');
const previews = [];

function createIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `icon icon-${name}`);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', name === 'pause' ? 'M9 5v14M15 5v14' : 'm8 5 11 7-11 7Z');
  if (name === 'pause') {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
  } else svg.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

// One lifecycle for inline previews: HLS on demand, muted playback, fade after
// the first frame, and suspended loading while offscreen or behind the dialog.
function createPreview(video, item, host, button, mode) {
  let stream = null;
  let visible = false;
  let hovered = false;
  let focused = false;
  let userIntent = null;
  let started = false;
  let usingFallback = false;
  let wanted = false;
  let generation = 0;
  let idleTimer = null;
  let pendingPlay = false;
  video.muted = video.defaultMuted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('muted', '');
  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.autoplay = mode !== 'hover';

  function syncButton() {
    button.setAttribute('aria-label', `${video.paused ? 'Spill' : 'Sett på pause'}: ${item.title}`);
    button.replaceChildren(createIcon(video.paused ? 'play' : 'pause'));
  }
  function revealFrame() {
    if (wanted) host.classList.add('preview-playing');
  }
  video.addEventListener('playing', () => {
    host.classList.remove('needs-play');
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(revealFrame);
    else revealFrame();
    syncButton();
  });
  video.addEventListener('pause', syncButton);

  function release() {
    generation++;
    if (stream) { stream.destroy(); stream = null; }
    started = false;
    usingFallback = false;
    video.removeAttribute('src');
    video.load();
  }
  function fallback() {
    if (!started || usingFallback) return;
    usingFallback = true;
    if (stream) { stream.destroy(); stream = null; }
    video.src = item.fallback;
    video.load();
    sync();
  }
  video.addEventListener('error', fallback);
  function start() {
    started = true;
    const token = ++generation;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = item.src;
    } else if (window.Hls && Hls.isSupported()) {
      stream = new Hls({ maxBufferLength: 8, maxMaxBufferLength: 12, capLevelToPlayerSize: true });
      let recovered = false;
      stream.on(Hls.Events.MANIFEST_PARSED, () => { if (token === generation) sync(); });
      stream.on(Hls.Events.ERROR, (_, data) => {
        if (!data.fatal || token !== generation) return;
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true;
          stream.recoverMediaError();
        } else fallback();
      });
      stream.loadSource(item.src);
      stream.attachMedia(video);
    } else fallback();
  }
  function sync() {
    const automatic = mode !== 'hover' || hovered || focused;
    wanted = visible && !document.hidden && !dialog.open && userIntent !== false &&
      (userIntent === true || (automatic && !motionPreference.matches));
    if (wanted) {
      clearTimeout(idleTimer);
      idleTimer = null;
      if (!started) start();
      if (stream) stream.startLoad(video.currentTime);
      video.muted = true;
      if (video.paused && !pendingPlay) {
        pendingPlay = true;
        video.play().catch(error => {
          if (wanted && error.name === 'NotAllowedError') host.classList.add('needs-play');
        }).finally(() => {
          pendingPlay = false;
          if (!wanted) video.pause();
        });
      }
    } else {
      video.pause();
      if (stream) stream.stopLoad();
      if (userIntent !== false || !visible || dialog.open) host.classList.remove('preview-playing');
      if (mode !== 'hero' && started && !idleTimer) idleTimer = setTimeout(() => {
        idleTimer = null;
        if (!wanted) release();
      }, 8000);
    }
    syncButton();
  }
  button.addEventListener('click', () => {
    userIntent = video.paused;
    sync();
  });
  if (mode === 'hover') {
    host.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && hoverPreference.matches) { hovered = true; sync(); }
    });
    host.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse') { hovered = false; userIntent = null; sync(); }
    });
    host.addEventListener('focusin', event => { focused = event.target.matches(':focus-visible'); sync(); });
    host.addEventListener('focusout', event => {
      if (!host.contains(event.relatedTarget)) { focused = false; sync(); }
    });
  }
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .1;
    sync();
  }, { threshold: [0, .1] }).observe(video);
  previews.push(sync);
  syncButton();
}

function syncPreviews() { previews.forEach(sync => sync()); }
function addInlineVideo(item, host, label) {
  const video = document.createElement('video');
  video.className = 'inline-preview';
  video.poster = item.preview;
  video.setAttribute('aria-label', label);
  host.querySelector('img').after(video);
  return video;
}
createPreview(document.getElementById('hero-video'), film('video', 'Showreel'),
  document.querySelector('.hero-film'), document.querySelector('.hero-pause'), 'hero');
document.querySelectorAll('[data-project]').forEach(link => {
  const item = projects[link.dataset.project].items.find(item => item.type === 'video');
  if (!item) return;
  const host = link.closest('.project-media');
  createPreview(addInlineVideo(item, link, `${projects[link.dataset.project].title} — forhåndsvisning`),
    item, host, host.querySelector('.preview-toggle'), 'hover');
});
document.querySelectorAll('[data-reel]').forEach(link => {
  const item = reels[Number(link.dataset.reel) - 1];
  const host = link.closest('.reel-item');
  createPreview(addInlineVideo(item, link.querySelector('.reel-cover'), `${item.title} — lydløs forhåndsvisning`),
    item, host, host.querySelector('.preview-toggle'), 'auto');
});
motionPreference.addEventListener('change', syncPreviews);

function disposeMedia() {
  mediaGeneration++;
  if (hls) { hls.destroy(); hls = null; }
  if (activeVideo) {
    activeVideo.pause();
    activeVideo.removeAttribute('src');
    activeVideo.load();
    activeVideo = null;
  }
  stage.replaceChildren();
  errorMessage.hidden = true;
  dialog.classList.remove('portrait-video');
}

function playFilm(item) {
  const generation = mediaGeneration;
  const video = document.createElement('video');
  video.controls = true;
  video.playsInline = true;
  video.preload = 'none';
  video.poster = item.preview;
  video.setAttribute('aria-label', `${selection.title} — ${item.title}`);
  video.addEventListener('loadedmetadata', () => {
    if (generation === mediaGeneration) dialog.classList.toggle('portrait-video', video.videoHeight > video.videoWidth);
  });
  stage.append(video);
  activeVideo = video;
  document.getElementById('media-fallback').href = item.fallback;
  let usingFallback = false;
  function fallback() {
    if (generation !== mediaGeneration || usingFallback) return;
    usingFallback = true;
    if (hls) { hls.destroy(); hls = null; }
    video.src = item.fallback;
    video.load();
    video.play().catch(() => {});
  }
  video.addEventListener('error', () => {
    if (generation !== mediaGeneration) return;
    if (!usingFallback) fallback();
    else errorMessage.hidden = false;
  });
  // Safari uses native HLS; hls.js plays the existing .ts segments elsewhere.
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = item.src;
    video.play().catch(() => {});
  } else if (window.Hls && Hls.isSupported()) {
    hls = new Hls({ maxBufferLength: 20, maxMaxBufferLength: 30, capLevelToPlayerSize: true });
    let recoveredMediaError = false;
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (generation === mediaGeneration) video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (!data.fatal || generation !== mediaGeneration) return;
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !recoveredMediaError) {
        recoveredMediaError = true;
        hls.recoverMediaError();
      } else fallback();
    });
    hls.loadSource(item.src);
    hls.attachMedia(video);
  } else fallback();
}

function showMedia(index) {
  if (!selection) return;
  disposeMedia();
  currentIndex = (index + selection.items.length) % selection.items.length;
  const item = selection.items[currentIndex];
  if (item.type === 'image') {
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = `${selection.title} — ${item.title}`;
    stage.append(img);
  } else playFilm(item);
  document.getElementById('viewer-caption').textContent = item.title;
  document.getElementById('viewer-counter').textContent = `${currentIndex + 1} / ${selection.items.length}`;
  previous.disabled = next.disabled = selection.items.length < 2;
  thumbnails.querySelectorAll('button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === currentIndex)));
}

function openViewer(collection, index, trigger) {
  selection = collection;
  opener = trigger;
  document.getElementById('viewer-title').textContent = collection.title;
  document.getElementById('viewer-category').textContent = collection.category;
  thumbnails.replaceChildren();
  collection.items.forEach((item, i) => {
    const button = document.createElement('button');
    button.className = 'viewer-thumb';
    button.type = 'button';
    button.setAttribute('aria-label', `${item.type === 'video' ? 'Spill film' : 'Vis bilde'}: ${item.title}`);
    const img = document.createElement('img');
    img.src = item.preview;
    img.alt = '';
    button.append(img);
    if (item.type === 'video') {
      const play = document.createElement('span');
      play.append(createIcon('play'));
      play.setAttribute('aria-hidden', 'true');
      button.append(play);
    }
    button.addEventListener('click', () => showMedia(i));
    thumbnails.append(button);
  });
  thumbnails.hidden = collection.items.length < 2;
  dialog.showModal();
  syncPreviews();
  document.body.classList.add('viewer-open');
  showMedia(index);
}

document.querySelectorAll('[data-project]').forEach(link => link.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openViewer(projects[link.dataset.project], 0, link);
}));
document.querySelectorAll('[data-reel]').forEach(link => link.addEventListener('click', event => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  openViewer({ title: 'Innholdsproduksjon', category: 'FILM & SOSIALE MEDIER', items: reels }, Number(link.dataset.reel) - 1, link);
}));
dialog.querySelector('.viewer-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
dialog.addEventListener('close', () => {
  disposeMedia();
  selection = null;
  thumbnails.replaceChildren();
  document.body.classList.remove('viewer-open');
  syncPreviews();
  opener?.focus({ preventScroll: true });
});
previous.addEventListener('click', () => showMedia(currentIndex - 1));
next.addEventListener('click', () => showMedia(currentIndex + 1));
dialog.addEventListener('keydown', event => {
  // Preserve the player's native arrow-key seeking and volume controls.
  if (event.target.closest('video')) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); showMedia(currentIndex - 1); }
  if (event.key === 'ArrowRight') { event.preventDefault(); showMedia(currentIndex + 1); }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && activeVideo) activeVideo.pause();
  syncPreviews();
});
