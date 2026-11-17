/* =========================================================
   ID HOMES · TEMA COMPARTIDO DEL PANEL
   ---------------------------------------------------------
   Aplica el mismo ciclo de cuatro momentos del dia que usa
   la app movil y la pantalla de acceso:

     05:00 - 07:59  amanecer
     08:00 - 16:59  dia
     17:00 - 19:59  atardecer
     20:00 - 04:59  noche

   Ademas inyecta el ambiente suave (orbe atenuado), cambia
   el logo segun el fondo y avisa al resto de la pagina con
   el evento 'idhomes:themechange' para que las graficas se
   vuelvan a dibujar con los colores correctos.
========================================================= */

(function () {
  'use strict';

  var THEMES = ['dawn', 'day', 'sunset', 'night'];

  var META_COLOR = {
    dawn: '#e7dcd5',
    day: '#c3e3f0',
    sunset: '#8b526f',
    night: '#0a1020'
  };

  var LOGO = {
    light: 'assets/logo-id-homes-light.png',
    dark: 'assets/logo-id-homes-dark.png'
  };

  var current = '';


  /* ---------------------------------------------------------
     Momento del dia
  --------------------------------------------------------- */

  function resolveTheme() {
    var hour = new Date().getHours();

    if (hour >= 5 && hour < 8) {
      return 'dawn';
    }

    if (hour >= 8 && hour < 17) {
      return 'day';
    }

    if (hour >= 17 && hour < 20) {
      return 'sunset';
    }

    return 'night';
  }


  /* ---------------------------------------------------------
     Ambiente: un solo orbe, detras del contenido
  --------------------------------------------------------- */

  function ensureAmbient() {
    if (document.querySelector('.ambient')) {
      return;
    }

    var ambient = document.createElement('div');
    ambient.className = 'ambient';
    ambient.setAttribute('aria-hidden', 'true');

    var haze = document.createElement('div');
    haze.className = 'orb-haze';

    var orb = document.createElement('div');
    orb.className = 'orb';

    ambient.appendChild(haze);
    ambient.appendChild(orb);
    document.body.insertBefore(ambient, document.body.firstChild);
  }


  /* ---------------------------------------------------------
     Logo: blanco sobre fondos oscuros, cyan sobre claros
  --------------------------------------------------------- */

  function applyLogo(theme) {
    var isLightBackground = theme === 'dawn' || theme === 'day';
    var src = isLightBackground ? LOGO.light : LOGO.dark;

    var logos = document.querySelectorAll(
      '#brandLogo, .brand-logo, .brand-lockup img'
    );

    Array.prototype.forEach.call(logos, function (img) {
      if (img.getAttribute('src') !== src) {
        img.setAttribute('src', src);
      }
      img.setAttribute('alt', 'ID Homes');
    });

    var sources = document.querySelectorAll('#logoSource');

    Array.prototype.forEach.call(sources, function (source) {
      source.setAttribute('srcset', src);
    });
  }


  /* ---------------------------------------------------------
     Aplicar tema
  --------------------------------------------------------- */

  function applyTheme(force) {
    var theme = resolveTheme();

    if (theme === current && force !== true) {
      return;
    }

    current = theme;

    THEMES.forEach(function (name) {
      document.body.classList.remove('theme-' + name);
    });

    document.body.classList.add('theme-' + theme);

    var meta = document.querySelector('meta[name="theme-color"]');

    if (meta) {
      meta.setAttribute('content', META_COLOR[theme]);
    }

    applyLogo(theme);

    document.dispatchEvent(
      new CustomEvent('idhomes:themechange', { detail: { theme: theme } })
    );
  }


  /* ---------------------------------------------------------
     Colores de tema para canvas (graficas)
  --------------------------------------------------------- */

  function themeInk() {
    var styles = getComputedStyle(document.body);

    function read(name, fallback) {
      var value = styles.getPropertyValue(name);
      return value && value.trim() ? value.trim() : fallback;
    }

    return {
      theme: current,
      text: read('--chart-text', '#e0e0e0'),
      muted: read('--chart-muted', '#9aa8b3'),
      grid: read('--chart-grid', 'rgba(154, 168, 179, 0.12)'),
      normal: read('--normal', '#00a3ff'),
      warning: read('--warning', '#ffb000'),
      critical: read('--critical', '#ff453a'),
      ok: read('--ok', '#2ecf7a'),
      brand: read('--brand', '#2ccde3')
    };
  }


  /* ---------------------------------------------------------
     Arranque
  --------------------------------------------------------- */

  function start() {
    ensureAmbient();
    applyTheme(true);

    // Revisa cada minuto si ya cambio el momento del dia.
    setInterval(applyTheme, 60000);

    // Al volver de segundo plano la hora pudo cambiar.
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        applyTheme();
      }
    });
  }

  window.IDHomesTheme = {
    resolve: resolveTheme,
    apply: applyTheme,
    ink: themeInk,
    current: function () {
      return current;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
