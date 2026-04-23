(function () {
    'use strict';

    var html    = document.documentElement;
    var sunIco  = document.getElementById('ico-sun');
    var moonIco = document.getElementById('ico-moon');

    function applyTheme(t) {
        html.setAttribute('data-theme', t);
        try { localStorage.setItem('als-theme', t); } catch(e) {}
        if (sunIco && moonIco) {
            sunIco.style.display  = t === 'light' ? 'block' : 'none';
            moonIco.style.display = t === 'dark'  ? 'block' : 'none';
        }
    }

    window.toggleTheme = function () {
        applyTheme(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    };

    // Init: stored → system → dark default
    var stored = null;
    try { stored = localStorage.getItem('als-theme'); } catch(e) {}
    var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(stored || (sysDark ? 'dark' : 'light'));

    var hamburger = document.getElementById('hamburger');
    var mobMenu   = document.getElementById('mob-menu');
    var mobOv     = document.getElementById('mob-ov');
    var menuOpen  = false;

    window.toggleMobileMenu = function () {
        menuOpen = !menuOpen;
        if (hamburger) hamburger.classList.toggle('open', menuOpen);
        if (mobMenu) {
            mobMenu.style.display = menuOpen ? 'block' : 'none';
            setTimeout(function () { mobMenu.classList.toggle('open', menuOpen); }, 10);
        }
        if (mobOv) {
            mobOv.style.display = menuOpen ? 'block' : 'none';
            setTimeout(function () { mobOv.classList.toggle('open', menuOpen); }, 10);
        }
        document.body.style.overflow = menuOpen ? 'hidden' : '';
    };

    if (mobMenu) mobMenu.style.display = 'none';
    if (mobOv)   mobOv.style.display   = 'none';

    window.toggleGroup = function (groupId) {
        var el = document.querySelector('.sb-group[data-group="' + groupId + '"]');
        if (el) el.classList.toggle('expanded');
    };

    var tocList = document.getElementById('toc-list');
    var docBody = document.getElementById('doc-body');

    if (tocList && docBody) {
        var headings = docBody.querySelectorAll('h2, h3');
        var tocItems = [];

        headings.forEach(function (h, i) {
            // Ensure heading has an id
            if (!h.id) {
                h.id = 'heading-' + i + '-' + h.textContent.trim().toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }

            var li  = document.createElement('li');
            var a   = document.createElement('a');
            a.href  = '#' + h.id;
            a.textContent = h.textContent.trim();
            a.className = 'toc-lnk';

            if (h.tagName === 'H3') li.className = 'h3-item';

            // Smooth scroll
            a.addEventListener('click', function (e) {
                e.preventDefault();
                h.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });

            li.appendChild(a);
            tocList.appendChild(li);
            tocItems.push({ el: h, link: a });
        });

        var tocFill = document.getElementById('toc-fill');

        function onScroll() {
            var st  = window.scrollY;
            var dH  = document.documentElement.scrollHeight - window.innerHeight;

            // Progress bar
            if (tocFill && dH > 0) {
                tocFill.style.width = Math.round(st / dH * 100) + '%';
            }

            // Active heading
            var current = '';
            tocItems.forEach(function (item) {
                if (item.el.getBoundingClientRect().top <= 90) {
                    current = item.el.id;
                }
            });

            tocItems.forEach(function (item) {
                var active = item.el.id === current;
                item.link.classList.toggle('active', active);
            });

            // Left sidebar active link (sb-nav)
            var sbLinks = document.querySelectorAll('.snav-lnk');
            sbLinks.forEach(function (lnk) {
                var href = lnk.getAttribute('href');
                if (href && href.startsWith('#')) {
                    lnk.classList.toggle('active', href === '#' + current);
                }
            });
        }

        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    var activeSb = document.querySelector('.sb-group-items li a.active');
    if (activeSb) {
        var group = activeSb.closest('.sb-group');
        if (group) group.classList.add('expanded');
    }

})();
