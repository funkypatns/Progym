(function initScopedZoom() {
    if (window.__licenseAdminScopedZoomInit) {
        return;
    }
    window.__licenseAdminScopedZoomInit = true;

    var ZOOM_KEY_PREFIX = 'license-admin:page-zoom:';
    var MIN_ZOOM = 0.8;
    var MAX_ZOOM = 1.8;
    var ZOOM_STEP = 0.1;

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function normalizeZoom(value) {
        var number = Number.parseFloat(String(value || '').trim());
        if (!Number.isFinite(number)) {
            return 1;
        }
        return Math.round(clamp(number, MIN_ZOOM, MAX_ZOOM) * 100) / 100;
    }

    function getZoomStorageKey() {
        return ZOOM_KEY_PREFIX + window.location.pathname;
    }

    function readStoredZoom() {
        try {
            var stored = window.localStorage.getItem(getZoomStorageKey());
            return normalizeZoom(stored);
        } catch (error) {
            console.warn('[license-admin-ui] Unable to read zoom preference:', error);
            return 1;
        }
    }

    function persistZoom(value) {
        try {
            window.localStorage.setItem(getZoomStorageKey(), String(value));
        } catch (error) {
            console.warn('[license-admin-ui] Unable to persist zoom preference:', error);
        }
    }

    function applyZoom(value) {
        var zoomValue = normalizeZoom(value);
        document.documentElement.style.zoom = String(zoomValue);
        document.documentElement.setAttribute('data-page-zoom', String(zoomValue));
        persistZoom(zoomValue);
    }

    function getCurrentZoom() {
        var fromAttr = document.documentElement.getAttribute('data-page-zoom');
        return normalizeZoom(fromAttr);
    }

    function increaseZoom() {
        applyZoom(getCurrentZoom() + ZOOM_STEP);
    }

    function decreaseZoom() {
        applyZoom(getCurrentZoom() - ZOOM_STEP);
    }

    function resetZoom() {
        applyZoom(1);
    }

    function hasZoomModifier(event) {
        return Boolean(event.ctrlKey || event.metaKey);
    }

    window.addEventListener(
        'wheel',
        function handleWheelZoom(event) {
            if (!hasZoomModifier(event)) {
                return;
            }
            event.preventDefault();
            if (event.deltaY < 0) {
                increaseZoom();
            } else if (event.deltaY > 0) {
                decreaseZoom();
            }
        },
        { passive: false }
    );

    window.addEventListener('keydown', function handleKeyZoom(event) {
        if (!hasZoomModifier(event)) {
            return;
        }

        var key = String(event.key || '').toLowerCase();
        if (key === '+' || key === '=' || key === 'add') {
            event.preventDefault();
            increaseZoom();
            return;
        }
        if (key === '-' || key === '_' || key === 'subtract') {
            event.preventDefault();
            decreaseZoom();
            return;
        }
        if (key === '0') {
            event.preventDefault();
            resetZoom();
        }
    });

    applyZoom(readStoredZoom());
})();
