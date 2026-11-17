<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$allowedOrigin = getenv('IDIND_ALLOWED_ORIGIN') ?: '';
if (
    $allowedOrigin !== ''
    && isset($_SERVER['HTTP_ORIGIN'])
    && hash_equals($allowedOrigin, (string) $_SERVER['HTTP_ORIGIN'])
) {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-API-TOKEN, X-CSRF-TOKEN, X-Requested-With, X-HIKVISION-BRIDGE-TOKEN, X-ZKTECO-BRIDGE-TOKEN');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Vary: Origin');
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$sharedConfig = [];
$sharedConfigOrigen = '';

/*
 * Rutas donde puede vivir crm/config.php, de la mas cercana
 * a la mas lejana.
 *
 * La primera cubre el despliegue de ID Homes, donde el API y
 * el CRM son hermanos dentro de la misma carpeta:
 *
 *   public_html/ID-Homes/IoT/api/   <- este archivo
 *   public_html/ID-Homes/IoT/crm/   <- config.php
 *
 * Las siguientes conservan la compatibilidad con los
 * despliegues anteriores de ID Industrial, donde el API
 * colgaba de un subdirectorio del raiz publico.
 */
$sharedConfigPaths = array_unique([
    dirname(__DIR__) . '/crm/config.php',
    dirname(__DIR__, 2) . '/crm/config.php',
    dirname(__DIR__, 3) . '/crm/config.php',
    dirname(__DIR__) . '/sistema/crm/config.php',
    dirname(__DIR__, 2) . '/sistema/crm/config.php',
    dirname(__DIR__, 3) . '/sistema/crm/config.php',
]);
foreach ($sharedConfigPaths as $sharedConfigPath) {
    if (!is_file($sharedConfigPath)) {
        continue;
    }
    $sharedConfigLoaded = require $sharedConfigPath;
    if (is_array($sharedConfigLoaded)) {
        $sharedConfig = $sharedConfigLoaded;
        $sharedConfigOrigen = $sharedConfigPath;
    }
    break;
}

$configLocal = is_array($sharedConfig['iot'] ?? null)
    ? $sharedConfig['iot']
    : [];
$configLocalSource = $configLocal !== [] ? 'crm/config.php: iot' : '';

$rutaConfigLocal = __DIR__ . '/config.local.php';
if ($configLocal === [] && is_file($rutaConfigLocal)) {
    $configCargada = require $rutaConfigLocal;
    if (is_array($configCargada)) {
        $configLocal = $configCargada;
        $configLocalSource = 'api/config.local.php';
    }
}

if ($sharedConfig === [] && $configLocal === []) {
    error_log('ID Industrial: no se encontro crm/config.php compartido ni api/config.local.php');
}

$dbHost = getenv('IDIND_DB_HOST')
    ?: ($sharedConfig['host'] ?? ($configLocal['db_host'] ?? 'localhost'));
$dbName = getenv('IDIND_DB_NAME')
    ?: ($sharedConfig['database'] ?? ($configLocal['db_name'] ?? 'TU_BASE_DE_DATOS'));
$dbUser = getenv('IDIND_DB_USER')
    ?: ($sharedConfig['username'] ?? ($configLocal['db_user'] ?? 'TU_USUARIO'));
$dbPass = getenv('IDIND_DB_PASS')
    ?: ($sharedConfig['password'] ?? ($configLocal['db_pass'] ?? 'TU_PASSWORD'));
$apiToken = getenv('IDIND_API_TOKEN')
    ?: ($configLocal['api_token'] ?? 'CAMBIA_ESTE_TOKEN_SECRETO');
$setupTokenLocal = trim((string) ($configLocal['setup_token'] ?? ''));
$setupTokenEntorno = trim((string) (getenv('IDIND_SETUP_TOKEN') ?: ''));
if ($setupTokenLocal !== '') {
    $setupToken = $setupTokenLocal;
    $setupTokenOrigen = $configLocalSource !== '' ? $configLocalSource : 'configuracion_local';
} elseif ($setupTokenEntorno !== '') {
    $setupToken = $setupTokenEntorno;
    $setupTokenOrigen = 'variable_de_entorno';
} else {
    $setupToken = 'CAMBIA_ESTE_TOKEN_DE_INSTALACION';
    $setupTokenOrigen = 'valor_por_defecto';
}

/*
 * Credenciales sin configurar
 * ---------------------------------------------------------
 * Si crm/config.php no aparecio, o aparecio pero todavia
 * trae los valores de ejemplo, no tiene sentido intentar la
 * conexion: el driver responderia "Access denied" y eso se
 * confunde con un password equivocado.
 *
 * El detalle completo (rutas revisadas y origen del config)
 * va unicamente al error_log del servidor. La respuesta HTTP
 * no expone nombres de base, usuarios ni rutas.
 */
$valorDePlantilla = static function (string $valor): bool {
    return (bool) preg_match(
        '/^(TU_|CAMBIA_|GENERA_)/i',
        trim($valor)
    );
};

/*
 * El password si puede estar vacio de forma legitima (MySQL
 * local sin clave), asi que solo se revisa que no siga siendo
 * un marcador de posicion. La base y el usuario si tienen que
 * venir con un valor real.
 */
$configuracionPendiente =
    trim($dbName) === ''
    || trim($dbUser) === ''
    || $valorDePlantilla($dbName)
    || $valorDePlantilla($dbUser)
    || $valorDePlantilla($dbPass);

function responderJson(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode(
        $payload,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
    );
    exit;
}

function requerirMetodo(string $metodo): void
{
    $actual = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($actual !== strtoupper($metodo)) {
        header('Allow: ' . strtoupper($metodo));
        responderJson(405, ['ok' => false, 'error' => 'Metodo no permitido']);
    }
}

function obtenerJson(): array
{
    $contenido = file_get_contents('php://input');
    if ($contenido === false || trim($contenido) === '' || strlen($contenido) > 16384) {
        responderJson(400, ['ok' => false, 'error' => 'Cuerpo JSON vacio o demasiado grande']);
    }

    $data = json_decode($contenido, true);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        responderJson(400, ['ok' => false, 'error' => 'JSON invalido']);
    }

    return $data;
}

function validarTokenDispositivo(): void
{
    global $apiToken;

    if ($apiToken === 'CAMBIA_ESTE_TOKEN_SECRETO' || strlen($apiToken) < 32) {
        responderJson(503, ['ok' => false, 'error' => 'Token de API no configurado']);
    }

    $tokenRecibido = (string) ($_SERVER['HTTP_X_API_TOKEN'] ?? '');
    if ($tokenRecibido === '' || !hash_equals($apiToken, $tokenRecibido)) {
        responderJson(401, ['ok' => false, 'error' => 'Token invalido']);
    }
}

if ($configuracionPendiente) {
    error_log(sprintf(
        'ID Homes DB: configuracion pendiente. Origen: %s. Rutas revisadas: %s',
        $sharedConfigOrigen !== '' ? $sharedConfigOrigen : 'ninguna (se uso api/config.local.php o los valores por defecto)',
        implode(' | ', $sharedConfigPaths)
    ));

    responderJson(503, [
        'ok' => false,
        'error' => 'La conexion a la base de datos todavia no esta configurada',
        'codigo' => 'DB_CONFIG_PENDIENTE',
    ]);
}

try {
    $pdo = new PDO(
        "mysql:host={$dbHost};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]
    );
    $pdo->exec("SET time_zone = '+00:00'");
} catch (Throwable $error) {

    /*
     * El mensaje del driver puede incluir host, base y usuario.
     * Se queda en el error_log del servidor; al cliente solo se
     * le devuelve un aviso generico.
     */
    error_log(sprintf(
        'ID Homes DB: %s (origen del config: %s)',
        $error->getMessage(),
        $sharedConfigOrigen !== '' ? $sharedConfigOrigen : 'api/config.local.php o valores por defecto'
    ));

    responderJson(
        500,
        [
            'ok' => false,
            'error' => 'No fue posible conectar con la base de datos',
            'codigo' => 'DB_CONEXION_FALLIDA',
        ]
    );
}