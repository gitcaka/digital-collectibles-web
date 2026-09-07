<?php

declare(strict_types=1);

final class ApiException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

function project_root(): string
{
    return dirname(__DIR__, 2);
}

function database_path(): string
{
    $configured = getenv('COLLECTIBLES_DB_PATH');
    return $configured !== false && $configured !== ''
        ? $configured
        : dirname(__DIR__) . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'collectibles.sqlite';
}

function db(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $path = database_path();
    $directory = dirname($path);
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new RuntimeException('无法创建数据库目录');
    }
    if (!file_exists($path)) {
        throw new RuntimeException('数据库尚未初始化，请先运行 php php-backend/bin/init.php');
    }

    $connection = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $connection->exec('PRAGMA foreign_keys = ON');
    $connection->exec('PRAGMA busy_timeout = 5000');
    $connection->exec('PRAGMA journal_mode = WAL');
    $connection->exec('PRAGMA synchronous = NORMAL');
    return $connection;
}

function uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

function body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new ApiException('请求内容格式不正确');
    }
    return $decoded;
}

function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function shanghai_date(int $offsetDays = 0): string
{
    $zone = new DateTimeZone('Asia/Shanghai');
    $date = new DateTimeImmutable('now', $zone);
    if ($offsetDays !== 0) {
        $date = $date->modify(($offsetDays > 0 ? '+' : '') . $offsetDays . ' day');
    }
    return $date->format('Y-m-d');
}

/**
 * 系统设置（键值对）。表尚未创建时静默回落到内置默认值。
 */
function settings(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $cache = ['yuanbao_name' => '元宝', 'points_name' => '积分'];
    try {
        $rows = db()->query('SELECT key, value FROM app_settings')->fetchAll();
        foreach ($rows as $row) {
            if (is_string($row['value']) && $row['value'] !== '') {
                $cache[$row['key']] = $row['value'];
            }
        }
    } catch (Throwable) {
        // 首次运行或表缺失时使用默认配置
    }
    return $cache;
}

function setting(string $key, string $default = ''): string
{
    return (string) (settings()[$key] ?? $default);
}

function currency_names(): array
{
    return [
        'yuanbao' => setting('yuanbao_name', '元宝'),
        'points' => setting('points_name', '积分'),
    ];
}

/**
 * 生成一次性随机兑换码，去掉了容易混淆的 0/O/1/I。
 */
function random_code(int $length = 10): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $result = '';
    for ($index = 0; $index < $length; $index++) {
        $result .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $result;
}

function integer_value(mixed $value, int $minimum, int $maximum, string $label): int
{
    if (filter_var($value, FILTER_VALIDATE_INT) === false) {
        throw new ApiException($label . '需为整数');
    }
    $parsed = (int) $value;
    if ($parsed < $minimum || $parsed > $maximum) {
        throw new ApiException($label . '超出允许范围');
    }
    return $parsed;
}

function current_user(bool $required = true, string $cookieName = 'dc_session'): ?array
{
    $sessionId = $_COOKIE[$cookieName] ?? '';
    if ($sessionId === '') {
        if ($required) {
            throw new ApiException('请先登录', 401);
        }
        return null;
    }
    $statement = db()->prepare(
        "SELECT u.id, u.username, u.display_name AS displayName, u.role,
                w.yuanbao, p.points, p.streak, p.last_checkin_date AS lastCheckinDate
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         JOIN wallets w ON w.user_id = u.id
         JOIN point_accounts p ON p.user_id = u.id
         WHERE s.id = :session AND datetime(s.expires_at) > datetime('now') AND u.status = 'active'"
    );
    $statement->execute(['session' => $sessionId]);
    $user = $statement->fetch();
    if (!$user && $required) {
        throw new ApiException('登录已过期，请重新登录', 401);
    }
    return $user ?: null;
}

/**
 * 管理员使用的会话 cookie 名（与用户端 dc_session 分离，短时效 + 滑动续期）。
 */
function admin_cookie_name(): string
{
    return 'dc_admin_session';
}

/**
 * 管理员会话续期：剩余有效期不足 20 分钟时顺延 30 分钟，并同步刷新浏览器 cookie。
 */
function touch_admin_session(): void
{
    $sessionId = $_COOKIE[admin_cookie_name()] ?? '';
    if ($sessionId === '') {
        return;
    }
    $statement = db()->prepare(
        "UPDATE user_sessions
         SET expires_at = datetime('now', '+30 minutes')
         WHERE id = ? AND datetime(expires_at) > datetime('now')
           AND datetime(expires_at) < datetime('now', '+20 minutes')"
    );
    $statement->execute([$sessionId]);
    if ($statement->rowCount() > 0) {
        setcookie(admin_cookie_name(), $sessionId, [
            'expires' => time() + 1800,
            'path' => '/',
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }
}

function require_admin(): array
{
    $user = current_user(true, admin_cookie_name());
    if ($user['role'] !== 'admin') {
        throw new ApiException('没有后台访问权限', 403);
    }
    touch_admin_session();
    return $user;
}

function begin_transaction(callable $operation): mixed
{
    $database = db();
    // BEGIN IMMEDIATE：进入写事务即拿到保留锁，避免并发下序列号/余额/sold 竞态。
    // 注意：pdo_sqlite 在 PHP <= 8.3 不会因 exec('BEGIN IMMEDIATE') 置位 PDO 内部
    // in_transaction 标志，此时调用 PDO::commit() 会直接抛 "There is no active
    // transaction"（写并未落库）。因此统一用原生 SQL COMMIT/ROLLBACK 收尾，
    // 跨 PHP 8.3 / 8.4 行为一致；SQLite 对无活动事务的 COMMIT/ROLLBACK 本身是空操作。
    $database->exec('BEGIN IMMEDIATE');
    try {
        $result = $operation($database);
        $database->exec('COMMIT');
        return $result;
    } catch (Throwable $error) {
        try {
            $database->exec('ROLLBACK');
        } catch (Throwable) {
            // 事务可能已被异常语句隐式结束（如 DDL），回滚失败可安全忽略
        }
        throw $error;
    }
}

