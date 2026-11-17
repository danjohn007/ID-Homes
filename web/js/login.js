const LOGIN_URL = '/ID-Homes/api/auth/login.php';
const SESSION_URL = '/ID-Homes/api/auth/me.php';
const SETUP_URL = '/ID-Homes/api/auth/crear_admin_inicial.php';


const loginForm =
  document.querySelector('#loginForm');

const loginMessage =
  document.querySelector('#loginMessage');

const setupToggle =
  document.querySelector('#setupToggle');

const setupForm =
  document.querySelector('#setupForm');

const setupMessage =
  document.querySelector('#setupMessage');

const passwordInput =
  document.querySelector('#passwordInput');

const passwordToggle =
  document.querySelector('#passwordToggle');

const brandLogo =
  document.querySelector('#brandLogo');

const logoSource =
  document.querySelector('#logoSource');

const timeEyebrow =
  document.querySelector('#timeEyebrow');

const mobileTimeEyebrow =
  document.querySelector('#mobileTimeEyebrow');

const themeColor =
  document.querySelector('#themeColor');


/* =========================================================
   PETICIONES JSON
========================================================= */

async function postJson(url, payload) {

  const response = await fetch(
    url,
    {
      method: 'POST',

      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },

      credentials: 'same-origin',

      cache: 'no-store',

      body: JSON.stringify(payload)
    }
  );


  const result =
    await response
      .json()
      .catch(() => ({}));


  if (
    !response.ok ||
    result?.ok === false
  ) {

    let message =
      result?.error ??
      `HTTP ${response.status}`;


    /*
     * Conservamos el diagnóstico que tenía
     * el proyecto original para el setup token.
     */

    if (
      result?.codigo === 'SETUP_TOKEN_MISMATCH' &&
      result?.detalle
    ) {

      message +=
        ` · origen: ${result.detalle.origen_configurado}` +
        ` · config.local: ${
          result.detalle.config_local_detectado
            ? 'si'
            : 'no'
        }` +
        ` · configurado: ${
          result.detalle.longitud_configurada
        }` +
        ` · recibido: ${
          result.detalle.longitud_recibida
        }`;

    }


    throw new Error(message);

  }


  return result;
}


/* =========================================================
   OBTENER FORM DATA
========================================================= */

function formPayload(form) {

  const payload =
    Object.fromEntries(
      new FormData(form).entries()
    );


  if (
    typeof payload.setup_token === 'string'
  ) {

    payload.setup_token =
      payload.setup_token.trim();

  }


  return payload;
}


/* =========================================================
   BLOQUEAR FORM DURANTE REQUEST
========================================================= */

function setFormBusy(form, busy) {

  form
    .querySelectorAll('input, button')
    .forEach((control) => {

      control.disabled = busy;

    });

}


/* =========================================================
   TEMA SEGÚN HORA
========================================================= */

function getTheme() {

  const hour =
    new Date().getHours();


  /*
   * 05:00 - 07:59
   * Amanecer
   */

  if (
    hour >= 5 &&
    hour < 8
  ) {

    return 'dawn';

  }


  /*
   * 08:00 - 16:59
   * Día
   */

  if (
    hour >= 8 &&
    hour < 17
  ) {

    return 'day';

  }


  /*
   * 17:00 - 19:59
   * Tarde / atardecer
   */

  if (
    hour >= 17 &&
    hour < 20
  ) {

    return 'sunset';

  }


  /*
   * 20:00 - 04:59
   * Noche
   */

  return 'night';
}


/* =========================================================
   APLICAR TEMA
========================================================= */

function applyTheme() {

  const theme =
    getTheme();


  document.body.classList.remove(
    'theme-dawn',
    'theme-day',
    'theme-sunset',
    'theme-night'
  );


  document.body.classList.add(
    `theme-${theme}`
  );


  /*
   * Logo oscuro para fondos claros.
   * Logo blanco para fondos oscuros.
   */

  const lightTheme =
    theme === 'dawn' ||
    theme === 'day';


  const logo =
    lightTheme
      ? 'assets/logo-id-homes-light.png'
      : 'assets/logo-id-homes-dark.png';


  if (brandLogo) {

    brandLogo.src = logo;

  }


  if (logoSource) {

    logoSource.srcset = logo;

  }


  const labels = {

    dawn:
      'Buenos días · Amanecer',

    day:
      'Tu hogar · Día',

    sunset:
      'Buenas tardes · Atardecer',

    night:
      'Buenas noches · Noche'

  };


  const mobileLabels = {

    dawn:
      'Buenos días',

    day:
      'ID Homes',

    sunset:
      'Buenas tardes',

    night:
      'Buenas noches'

  };


  if (timeEyebrow) {

    timeEyebrow.textContent =
      labels[theme];

  }


  if (mobileTimeEyebrow) {

    mobileTimeEyebrow.textContent =
      mobileLabels[theme];

  }


  const colors = {

    dawn:
      '#cbd7e4',

    day:
      '#81c2eb',

    sunset:
      '#362850',

    night:
      '#050918'

  };


  themeColor?.setAttribute(
    'content',
    colors[theme]
  );
}


/* =========================================================
   SESIÓN EXISTENTE
========================================================= */

async function checkExistingSession() {

  try {

    const response =
      await fetch(
        SESSION_URL,
        {
          headers: {
            Accept: 'application/json'
          },

          credentials:
            'same-origin',

          cache:
            'no-store'
        }
      );


    /*
     * Si ya hay sesión válida no mostramos login.
     */

    if (response.ok) {

      window.location.replace(
        './index.html'
      );

    }

  } catch (error) {

    /*
     * Si la API está caída o no responde,
     * dejamos el formulario disponible.
     */

    console.warn(
      'No fue posible comprobar la sesión.',
      error
    );

  }

}


/* =========================================================
   MOSTRAR / OCULTAR PASSWORD
========================================================= */

passwordToggle?.addEventListener(
  'click',
  () => {

    const visible =
      passwordInput.type === 'text';


    passwordInput.type =
      visible
        ? 'password'
        : 'text';


    const label =
      visible
        ? 'Mostrar contraseña'
        : 'Ocultar contraseña';


    passwordToggle.setAttribute(
      'aria-label',
      label
    );


    passwordToggle.setAttribute(
      'title',
      label
    );


    passwordInput.focus();

  }
);


/* =========================================================
   LOGIN
========================================================= */

loginForm.addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();


    if (
      !loginForm.reportValidity()
    ) {

      return;

    }


    const payload =
      formPayload(loginForm);


    setFormBusy(
      loginForm,
      true
    );


    loginMessage
      .classList
      .remove('success');


    loginMessage.textContent =
      'Validando acceso...';


    try {

      /*
       * IMPORTANTE:
       * aquí seguimos llamando exactamente al
       * backend existente.
       */

      await postJson(
        LOGIN_URL,
        payload
      );


      loginMessage
        .classList
        .add('success');


      loginMessage.textContent =
        'Acceso correcto. Entrando...';


      /*
       * El backend ya creó la sesión PHP.
       */

      window.location.replace(
        './index.html'
      );


    } catch (error) {

      loginMessage
        .classList
        .remove('success');


      loginMessage.textContent =
        error.message ||
        'No fue posible iniciar sesión.';

    } finally {

      setFormBusy(
        loginForm,
        false
      );

    }

  }
);


/* =========================================================
   MOSTRAR SETUP
========================================================= */

setupToggle.addEventListener(
  'click',
  () => {

    const willOpen =
      setupForm.hidden;


    setupForm.hidden =
      !willOpen;


    setupToggle.setAttribute(
      'aria-expanded',
      String(willOpen)
    );


    setupToggle.textContent =
      willOpen
        ? 'Ocultar configuración inicial'
        : 'Configuración inicial';


    if (willOpen) {

      setupForm
        .querySelector('input')
        ?.focus();

    }

  }
);


/* =========================================================
   CREAR ADMIN INICIAL
   SE CONSERVA DEL PROYECTO ORIGINAL
========================================================= */

setupForm.addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();


    if (
      !setupForm.reportValidity()
    ) {

      return;

    }


    const payload =
      formPayload(setupForm);


    setFormBusy(
      setupForm,
      true
    );


    setupMessage
      .classList
      .remove('success');


    setupMessage.textContent =
      'Creando administrador...';


    try {

      await postJson(
        SETUP_URL,
        payload
      );


      setupMessage
        .classList
        .add('success');


      setupMessage.textContent =
        'Administrador creado. Entrando...';


      window.location.replace(
        './index.html'
      );


    } catch (error) {

      setupMessage
        .classList
        .remove('success');


      setupMessage.textContent =
        error.message ||
        'No fue posible crear el administrador.';

    } finally {

      setFormBusy(
        setupForm,
        false
      );

    }

  }
);


/* =========================================================
   INICIALIZACIÓN
========================================================= */

applyTheme();


/*
 * Revisa cada minuto si cambió el periodo del día.
 */

setInterval(
  applyTheme,
  60000
);


/*
 * Comprobar sesión al entrar.
 */

checkExistingSession();