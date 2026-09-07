<?php

declare(strict_types=1);

require __DIR__ . '/src/bootstrap.php';

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/**
 * 首页横幅，按后台配置的顺序输出。
 */
function active_banners(): array
{
    return db()->query(
        "SELECT id, title, image_url AS imageUrl, link
         FROM banners WHERE status = 'active'
         ORDER BY sort_order ASC, created_at ASC"
    )->fetchAll();
}

const RANKING_BOARDS = ['collections', 'yuanbao', 'points', 'rarity'];
const COLLECTION_RARITIES = ['传说', '史诗', '稀有', '普通'];

/**
 * 把「全量有序名单」整理成榜单：按需截取前 N 名并标出当前用户的位置。
 */
function build_leaderboard(array $rows, string $userId, int $limit = 20): array
{
    $entries = [];
    foreach (array_slice($rows, 0, max(1, $limit)) as $index => $row) {
        $entries[] = [
            'rank' => $index + 1,
            'userId' => $row['userId'],
            'username' => $row['username'],
            'displayName' => $row['displayName'],
            'value' => (int) $row['value'],
            'isMe' => $row['userId'] === $userId,
        ];
    }
    return ['entries' => $entries, 'me' => ranking_position($rows, $userId), 'total' => count($rows)];
}

/**
 * 当前用户在全量名单中的名次，未上榜时返回 null。
 */
function ranking_position(array $rows, string $userId): ?array
{
    foreach ($rows as $index => $row) {
        if ($row['userId'] === $userId) {
            return ['rank' => $index + 1, 'value' => (int) $row['value']];
        }
    }
    return null;
}

/**
 * 取某个榜单的全量有序名单（首页截取、详情页分页共用）。
 */
function ranking_rows(string $board): array
{
    $database = db();

    if ($board === 'collections') {
        return $database->query(
            "SELECT u.id AS userId, u.username, u.display_name AS displayName, COUNT(uc.id) AS value
             FROM users u LEFT JOIN user_collections uc ON uc.user_id = u.id
             WHERE u.status = 'active' AND u.role = 'user'
             GROUP BY u.id ORDER BY value DESC, u.created_at ASC"
        )->fetchAll();
    }

    if ($board === 'yuanbao') {
        return $database->query(
            "SELECT u.id AS userId, u.username, u.display_name AS displayName, w.yuanbao AS value
             FROM users u JOIN wallets w ON w.user_id = u.id
             WHERE u.status = 'active' AND u.role = 'user'
             ORDER BY w.yuanbao DESC, u.created_at ASC"
        )->fetchAll();
    }

    if ($board === 'points') {
        return $database->query(
            "SELECT u.id AS userId, u.username, u.display_name AS displayName, p.points AS value
             FROM users u JOIN point_accounts p ON p.user_id = u.id
             WHERE u.status = 'active' AND u.role = 'user'
             ORDER BY p.points DESC, u.created_at ASC"
        )->fetchAll();
    }

    return $database->query(
        "SELECT u.id AS userId, u.username, u.display_name AS displayName,
                COALESCE(SUM(
                  CASE c.rarity
                    WHEN '传说' THEN 4
                    WHEN '史诗' THEN 3
                    WHEN '稀有' THEN 2
                    ELSE 1
                  END
                ), 0) AS value
         FROM users u
         LEFT JOIN user_collections uc ON uc.user_id = u.id
         LEFT JOIN collections c ON c.id = uc.collection_id
         WHERE u.status = 'active' AND u.role = 'user'
         GROUP BY u.id ORDER BY value DESC, u.created_at ASC"
    )->fetchAll();
}

function fetch_rankings(string $userId, int $limit = 10): array
{
    return [
        'collections' => build_leaderboard(ranking_rows('collections'), $userId, $limit),
        'yuanbao' => build_leaderboard(ranking_rows('yuanbao'), $userId, $limit),
        'points' => build_leaderboard(ranking_rows('points'), $userId, $limit),
        'rarity' => build_leaderboard(ranking_rows('rarity'), $userId, $limit),
    ];
}

function fetch_app_state(array $user): array
{
    $database = db();
    $collections = $database->query(
        "SELECT id, name, subtitle, description, rarity, price, points_price AS pointsPrice,
                redeem_mode AS redeemMode, total, sold, transferable, image_url AS imageUrl, status
         FROM collections WHERE status != 'archived' ORDER BY price DESC"
    )->fetchAll();
    foreach ($collections as &$collection) {
        $collection['transferable'] = (bool) $collection['transferable'];
        $collection['pointsPrice'] = (int) $collection['pointsPrice'];
    }
    unset($collection);

    $inventoryStatement = $database->prepare(
        "SELECT uc.id, uc.collection_id AS collectionId, uc.serial_no AS serialNo,
                uc.source, uc.status, uc.acquired_at AS acquiredAt,
            c.name, c.subtitle, c.description, c.rarity, c.price, c.points_price AS pointsPrice,
            c.redeem_mode AS redeemMode, c.total, c.sold, c.transferable, c.image_url AS imageUrl
         FROM user_collections uc
         JOIN collections c ON c.id = uc.collection_id
         WHERE uc.user_id = ? ORDER BY uc.acquired_at DESC"
    );
    $inventoryStatement->execute([$user['id']]);
    $inventory = $inventoryStatement->fetchAll();
    foreach ($inventory as &$item) {
        $item['transferable'] = (bool) $item['transferable'];
        $item['pointsPrice'] = (int) $item['pointsPrice'];
    }
    unset($item);

    $recordsStatement = $database->prepare(
        'SELECT code_snapshot AS code, reward_summary AS reward, created_at AS createdAt
         FROM redeem_records WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
    );
    $recordsStatement->execute([$user['id']]);

    $transferStatement = $database->prepare(
        "SELECT t.id, t.sender_user_id AS senderUserId, t.recipient_user_id AS recipientUserId,
                t.recipient_username AS recipientUsername, t.user_collection_id AS userCollectionId,
                t.collection_id AS collectionId, t.price, t.fee, t.status, t.created_at AS createdAt,
                c.name, c.rarity, c.image_url AS imageUrl,
                sender.username AS senderUsername, sender.display_name AS senderDisplayName
         FROM transfers t
         JOIN collections c ON c.id = t.collection_id
         JOIN users sender ON sender.id = t.sender_user_id
         WHERE t.sender_user_id = ? OR t.recipient_user_id = ?
         ORDER BY t.created_at DESC LIMIT 30"
    );
    $transferStatement->execute([$user['id'], $user['id']]);

    return [
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'displayName' => $user['displayName'],
            'role' => $user['role'],
        ],
        'wallet' => ['yuanbao' => (int) $user['yuanbao']],
        'points' => [
            'total' => (int) $user['points'],
            'streak' => (int) $user['streak'],
            'lastCheckinDate' => $user['lastCheckinDate'],
            'signedToday' => $user['lastCheckinDate'] === shanghai_date(),
        ],
        'collections' => $collections,
        'inventory' => $inventory,
        'redeemRecords' => $recordsStatement->fetchAll(),
        'transfers' => $transferStatement->fetchAll(),
        'banners' => active_banners(),
        'rankings' => fetch_rankings($user['id']),
        'settings' => currency_names(),
    ];
}

function collection_detail(string $id, array $user): array
{
    $statement = db()->prepare(
        "SELECT id, name, subtitle, description, rarity, price, points_price AS pointsPrice,
                redeem_mode AS redeemMode, total, sold, transferable, image_url AS imageUrl, status
         FROM collections WHERE id = ? AND status != 'archived'"
    );
    $statement->execute([$id]);
    $collection = $statement->fetch();
    if (!$collection) {
        throw new ApiException('藏品不存在', 404);
    }
    $collection['transferable'] = (bool) $collection['transferable'];
    $collection['pointsPrice'] = (int) $collection['pointsPrice'];
    $holdings = db()->prepare(
        'SELECT id, serial_no AS serialNo, source, status, acquired_at AS acquiredAt
         FROM user_collections WHERE user_id = ? AND collection_id = ? ORDER BY acquired_at DESC'
    );
    $holdings->execute([$user['id'], $id]);
    return [
        'collection' => $collection,
        'holdings' => $holdings->fetchAll(),
        'balance' => (int) $user['yuanbao'],
        'pointsBalance' => (int) $user['points'],
        'settings' => currency_names(),
    ];
}

function admin_overview(): array
{
    $database = db();
    $metrics = $database->query(
        "SELECT
           (SELECT COUNT(*) FROM users) AS userCount,
           (SELECT COUNT(*) FROM user_collections) AS holdingCount,
           (SELECT COUNT(*) FROM redeem_records) AS redemptionCount,
           (SELECT COUNT(*) FROM transfers WHERE status = 'pending') AS pendingTransferCount,
           (SELECT COALESCE(SUM(yuanbao), 0) FROM wallets) AS yuanbaoTotal"
    )->fetch();
    $collections = $database->query(
        'SELECT id, name, subtitle, description, rarity, price, points_price AS pointsPrice,
                redeem_mode AS redeemMode, total, sold, transferable, image_url AS imageUrl, status
         FROM collections ORDER BY price DESC'
    )->fetchAll();
    foreach ($collections as &$collection) {
        $collection['transferable'] = (bool) $collection['transferable'];
        $collection['pointsPrice'] = (int) $collection['pointsPrice'];
    }
    unset($collection);
    $codes = $database->query(
        "SELECT rc.id, rc.code, rc.title, rc.kind, rc.status, rc.max_total AS maxTotal,
                rc.max_per_user AS maxPerUser, rc.used_count AS usedCount, rc.created_at AS createdAt,
                GROUP_CONCAT(rr.label, ' + ') AS rewards
         FROM redeem_codes rc LEFT JOIN redeem_code_rewards rr ON rr.redeem_code_id = rc.id
         GROUP BY rc.id ORDER BY rc.created_at DESC"
    )->fetchAll();
    foreach ($codes as &$code) {
        $code['usedCount'] = (int) $code['usedCount'];
    }
    unset($code);
    $users = $database->query(
        'SELECT u.id, u.username, u.display_name AS displayName, u.role, u.status,
                u.created_at AS createdAt, w.yuanbao, p.points, COUNT(uc.id) AS holdingCount
         FROM users u JOIN wallets w ON w.user_id = u.id
         JOIN point_accounts p ON p.user_id = u.id
         LEFT JOIN user_collections uc ON uc.user_id = u.id
         GROUP BY u.id ORDER BY u.created_at DESC'
    )->fetchAll();
    $transfers = $database->query(
        'SELECT t.id, t.status, t.price, t.fee, t.created_at AS createdAt, c.name,
                sender.username AS senderUsername, t.recipient_username AS recipientUsername
         FROM transfers t JOIN collections c ON c.id = t.collection_id
         JOIN users sender ON sender.id = t.sender_user_id
         ORDER BY t.created_at DESC LIMIT 40'
    )->fetchAll();
    $banners = $database->query(
        'SELECT id, title, image_url AS imageUrl, link, sort_order AS sortOrder, status
         FROM banners ORDER BY sort_order ASC, created_at ASC'
    )->fetchAll();
    foreach ($banners as &$banner) {
        $banner['sortOrder'] = (int) $banner['sortOrder'];
    }
    unset($banner);

    return compact('metrics', 'collections', 'codes', 'users', 'transfers', 'banners')
        + ['settings' => currency_names()];
}

/**
 * 审计日志：把一次成功的后台管理写操作落库（admin_action 内、json_response 前调用）。
 */
function record_audit(array $admin, string $action, string $target, string $detail = ''): void
{
    db()->prepare(
        'INSERT INTO audit_logs (id, admin_id, admin_name, action, target, detail, created_at)
         VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    )->execute([uuid(), $admin['id'], (string) $admin['displayName'], $action, $target, $detail]);
}

/**
 * 运营趋势统计：近 N 日（仅 7/30）的兑换次数、新增用户、转让成交量按天聚合，
 * 日期统一取上海时区的自然日，与种子演示数据的时间戳口径一致。
 */
function admin_stats(): array
{
    $days = (int) ($_GET['days'] ?? 30);
    if (!in_array($days, [7, 30], true)) {
        $days = 30;
    }
    $cutoff = shanghai_date(1 - $days);
    $dates = [];
    for ($offset = 1 - $days; $offset <= 0; $offset++) {
        $dates[] = shanghai_date($offset);
    }
    $database = db();

    $countsByDay = static function (string $sql) use ($database): array {
        $map = [];
        foreach ($database->query($sql)->fetchAll() as $row) {
            $map[$row['day']] = (int) $row['n'];
        }
        return $map;
    };
    $redeems = $countsByDay("SELECT date(created_at) AS day, COUNT(*) AS n FROM redeem_records WHERE date(created_at) >= '{$cutoff}' GROUP BY date(created_at)");
    $users = $countsByDay("SELECT date(created_at) AS day, COUNT(*) AS n FROM users WHERE date(created_at) >= '{$cutoff}' GROUP BY date(created_at)");
    $transfers = $countsByDay(
        "SELECT date(COALESCE(completed_at, created_at)) AS day, COUNT(*) AS n
         FROM transfers WHERE status = 'completed' AND date(COALESCE(completed_at, created_at)) >= '{$cutoff}'
         GROUP BY date(COALESCE(completed_at, created_at))"
    );

    $series = [];
    foreach ([
        ['redeem', '兑换次数', $redeems],
        ['user', '新增用户', $users],
        ['transfer', '转让成交', $transfers],
    ] as [$key, $name, $map]) {
        $points = [];
        $total = 0;
        foreach ($dates as $date) {
            $value = $map[$date] ?? 0;
            $total += $value;
            $points[] = ['date' => substr($date, 5), 'full' => $date, 'value' => $value];
        }
        $series[] = ['key' => $key, 'name' => $name, 'total' => $total, 'points' => $points];
    }
    return ['days' => $days, 'series' => $series];
}

/**
 * 审计日志查询（分页，按时间倒序，可按操作类型与关键字过滤）。
 */
function admin_audit_log(): array
{
    $page = max(1, (int) ($_GET['page'] ?? 1));
    $pageSize = (int) ($_GET['pageSize'] ?? 20);
    if ($pageSize < 1 || $pageSize > 100) {
        $pageSize = 20;
    }
    $actionFilter = trim((string) ($_GET['action'] ?? ''));
    $keyword = trim((string) ($_GET['keyword'] ?? ''));

    $where = [];
    $parameters = [];
    if ($actionFilter !== '') {
        $where[] = 'action = :action';
        $parameters['action'] = $actionFilter;
    }
    if ($keyword !== '') {
        $where[] = '(target LIKE :kw OR detail LIKE :kw OR admin_name LIKE :kw OR action LIKE :kw)';
        $parameters['kw'] = "%{$keyword}%";
    }
    $condition = $where !== [] ? ' WHERE ' . implode(' AND ', $where) : '';
    // LIMIT/OFFSET 用校验过的整数直接拼接，避免绑定参数在不同 PDO 驱动下的兼容问题。
    $offset = ($page - 1) * $pageSize;

    $database = db();
    $countStatement = $database->prepare('SELECT COUNT(*) FROM audit_logs' . $condition);
    $countStatement->execute($parameters);
    $total = (int) $countStatement->fetchColumn();

    $itemsStatement = $database->prepare(
        'SELECT id, admin_id AS adminId, admin_name AS adminName, action, target, detail,
                created_at AS createdAt
         FROM audit_logs' . $condition . "
         ORDER BY created_at DESC, id DESC
         LIMIT {$pageSize} OFFSET {$offset}"
    );
    $itemsStatement->execute($parameters);
    $items = $itemsStatement->fetchAll();
    return ['items' => $items, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
}

/**
 * CSV 导出（管理端）：users / redeems / transfers 三类，UTF-8 BOM 便于 Excel 直开。
 */
function admin_export_csv(): never
{
    $type = (string) ($_GET['type'] ?? '');
    $database = db();
    $headers = [];
    $rows = [];

    if ($type === 'users') {
        $headers = ['用户名', '昵称', '角色', '状态', '元宝', '积分', '持有藏品', '注册时间'];
        $rows = $database->query(
            "SELECT u.username, u.display_name, u.role, u.status, w.yuanbao, p.points,
                    (SELECT COUNT(*) FROM user_collections uc WHERE uc.user_id = u.id) AS holdings,
                    u.created_at
             FROM users u JOIN wallets w ON w.user_id = u.id JOIN point_accounts p ON p.user_id = u.id
             ORDER BY u.created_at DESC"
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['role'] = $row['role'] === 'admin' ? '管理员' : '普通用户';
            $row['status'] = $row['status'] === 'active' ? '启用' : '停用';
        }
        unset($row);
    } elseif ($type === 'redeems') {
        $headers = ['用户名', '昵称', '兑换码', '奖励', '兑换时间'];
        $rows = $database->query(
            "SELECT u.username, u.display_name, r.code_snapshot AS code, r.reward_summary AS reward, r.created_at
             FROM redeem_records r JOIN users u ON u.id = r.user_id
             ORDER BY r.created_at DESC"
        )->fetchAll();
    } elseif ($type === 'transfers') {
        $headers = ['转让单', '藏品', '发起人', '接收人', '价格', '手续费', '状态', '发起时间', '完成时间'];
        $rows = $database->query(
            "SELECT t.id, c.name, sender.username AS sender, t.recipient_username AS recipient,
                    t.price, t.fee, t.status, t.created_at, t.completed_at
             FROM transfers t JOIN collections c ON c.id = t.collection_id
             JOIN users sender ON sender.id = t.sender_user_id
             ORDER BY t.created_at DESC"
        )->fetchAll();
        foreach ($rows as &$row) {
            $row['status'] = $row['status'] === 'pending' ? '待确认' : ($row['status'] === 'completed' ? '已完成' : ($row['status'] === 'rejected' ? '已拒绝' : '已关闭'));
        }
        unset($row);
    } else {
        throw new ApiException('不支持的导出类型', 404);
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="collectibles-' . $type . '-' . gmdate('YmdHis') . '.csv"');
    $stream = fopen('php://output', 'wb');
    fwrite($stream, "\xEF\xBB\xBF");
    fputcsv($stream, $headers, ',', '"', '');
    foreach ($rows as $row) {
        fputcsv($stream, array_values($row), ',', '"', '');
    }
    fclose($stream);
    exit;
}

/**
 * 登录失败计数（SQLite 持久化）。按“用户名 + 来源 IP”分别累计，
 * 15 分钟窗口内失败 ≥6 次即临时拦截；跨请求生效，适合单机/多进程部署。
 */
function ensure_login_attempts_table(): void
{
    db()->exec(
        'CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            k TEXT NOT NULL,
            attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )'
    );
    db()->exec("DELETE FROM login_attempts WHERE attempted_at <= datetime('now', '-1 day')");
}

function login_throttle(string $username): void
{
    ensure_login_attempts_table();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $lookup = db()->prepare(
        "SELECT COUNT(*) FROM login_attempts
         WHERE k = ? AND attempted_at > datetime('now', '-15 minutes')"
    );
    foreach (['u:' . $username, 'ip:' . $ip] as $key) {
        $lookup->execute([$key]);
        if ((int) $lookup->fetchColumn() >= 6) {
            throw new ApiException('尝试次数过多，请 15 分钟后再试', 429);
        }
    }
}

function record_login_failure(string $username): void
{
    ensure_login_attempts_table();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $insert = db()->prepare('INSERT INTO login_attempts (k) VALUES (?)');
    $insert->execute(['u:' . $username]);
    $insert->execute(['ip:' . $ip]);
}

function clear_login_failures(string $username): void
{
    db()->prepare('DELETE FROM login_attempts WHERE k = ?')->execute(['u:' . $username]);
}

function login(): never
{
    $input = body();
    $username = strtolower(trim((string) ($input['username'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    if ($username === '' || $password === '') {
        throw new ApiException('请输入用户名和密码');
    }
    login_throttle($username);
    $statement = db()->prepare(
        "SELECT id, username, display_name AS displayName, role, password_hash AS passwordHash
         FROM users WHERE username = ? COLLATE NOCASE AND status = 'active'"
    );
    $statement->execute([$username]);
    $user = $statement->fetch();
    if (!$user || !password_verify($password, $user['passwordHash'])) {
        record_login_failure($username);
        throw new ApiException('用户名或密码不正确', 401);
    }
    clear_login_failures($username);
    $sessionId = uuid();
    $expires = (new DateTimeImmutable('+7 days'))->format('Y-m-d H:i:s');
    db()->prepare('INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        ->execute([$sessionId, $user['id'], $expires]);
    setcookie('dc_session', $sessionId, [
        'expires' => time() + 604800,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    json_response(['success' => true, 'user' => [
        'username' => $user['username'], 'displayName' => $user['displayName'], 'role' => $user['role'],
    ]]);
}

/**
 * 管理后台独立登录：会话 30 分钟短时效，cookie 与用户端分离，活动时滑动续期。
 */
function admin_login(): never
{
    $input = body();
    $username = strtolower(trim((string) ($input['username'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    if ($username === '' || $password === '') {
        throw new ApiException('请输入管理员账号和密码');
    }
    login_throttle($username);
    $statement = db()->prepare(
        "SELECT id, username, display_name AS displayName, role, password_hash AS passwordHash
         FROM users WHERE username = ? COLLATE NOCASE AND status = 'active'"
    );
    $statement->execute([$username]);
    $user = $statement->fetch();
    if (!$user || $user['role'] !== 'admin' || !password_verify($password, $user['passwordHash'])) {
        record_login_failure($username);
        throw new ApiException('管理员账号或密码不正确', 401);
    }
    clear_login_failures($username);
    $sessionId = uuid();
    $cookie = admin_cookie_name();
    db()->prepare("INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 minutes'))")
        ->execute([$sessionId, $user['id']]);
    setcookie($cookie, $sessionId, [
        'expires' => time() + 1800,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    json_response(['success' => true, 'user' => [
        'username' => $user['username'], 'displayName' => $user['displayName'], 'role' => $user['role'],
    ]]);
}

function admin_logout(): never
{
    $sessionId = $_COOKIE[admin_cookie_name()] ?? '';
    if ($sessionId !== '') {
        db()->prepare('DELETE FROM user_sessions WHERE id = ?')->execute([$sessionId]);
    }
    setcookie(admin_cookie_name(), '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    json_response(['success' => true]);
}

function register_user(): never
{
    $input = body();
    $username = strtolower(trim((string) ($input['username'] ?? '')));
    $password = (string) ($input['password'] ?? '');
    $displayName = trim((string) ($input['displayName'] ?? $username));
    if (!preg_match('/^[a-z0-9_]{4,20}$/', $username)) {
        throw new ApiException('用户名需为 4–20 位字母、数字或下划线');
    }
    if (strlen($password) < 8 || strlen($password) > 64) {
        throw new ApiException('密码需为 8–64 位');
    }
    if ($displayName === '' || mb_strlen($displayName) > 20) {
        throw new ApiException('昵称需为 1–20 个字');
    }
    $exists = db()->prepare('SELECT id FROM users WHERE username = ? COLLATE NOCASE');
    $exists->execute([$username]);
    if ($exists->fetch()) {
        throw new ApiException('该用户名已被注册', 409);
    }
    $userId = uuid();
    begin_transaction(function (PDO $database) use ($userId, $username, $password, $displayName): void {
        $database->prepare('INSERT INTO users (id, username, password_hash, display_name, role, status) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$userId, $username, password_hash($password, PASSWORD_DEFAULT), $displayName, 'user', 'active']);
        $database->prepare('INSERT INTO wallets (user_id, yuanbao) VALUES (?, ?)')->execute([$userId, 600]);
        $database->prepare('INSERT INTO point_accounts (user_id, points, streak) VALUES (?, ?, ?)')->execute([$userId, 0, 0]);
    });
    $sessionId = uuid();
    db()->prepare('INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
        ->execute([$sessionId, $userId, (new DateTimeImmutable('+7 days'))->format('Y-m-d H:i:s')]);
    setcookie('dc_session', $sessionId, ['expires' => time() + 604800, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    json_response(['success' => true, 'user' => ['username' => $username, 'displayName' => $displayName, 'role' => 'user']], 201);
}

function redeem_code(array $user): never
{
    $input = body();
    $codeInput = strtoupper(trim((string) ($input['code'] ?? '')));
    if ($codeInput === '') {
        throw new ApiException('请输入兑换码');
    }
    $statement = db()->prepare(
        'SELECT id, code, status, max_total AS maxTotal, max_per_user AS maxPerUser, used_count AS usedCount
         FROM redeem_codes WHERE code = ? COLLATE NOCASE'
    );
    $statement->execute([$codeInput]);
    $code = $statement->fetch();
    if (!$code) throw new ApiException('兑换码不存在', 404);
    if ($code['status'] !== 'active') throw new ApiException('兑换码已停用');
    if ((int) $code['usedCount'] >= (int) $code['maxTotal']) throw new ApiException('兑换码已达使用上限');
    $usage = db()->prepare('SELECT COUNT(*) FROM redeem_records WHERE user_id = ? AND redeem_code_id = ?');
    $usage->execute([$user['id'], $code['id']]);
    if ((int) $usage->fetchColumn() >= (int) $code['maxPerUser']) throw new ApiException('该兑换码你已经使用过了', 409);
    $rewardsQuery = db()->prepare(
        'SELECT reward_type AS rewardType, amount, collection_id AS collectionId, label
         FROM redeem_code_rewards WHERE redeem_code_id = ? ORDER BY id'
    );
    $rewardsQuery->execute([$code['id']]);
    $rewards = $rewardsQuery->fetchAll();
    if (!$rewards) throw new ApiException('兑换码没有配置奖励');

    $summary = implode(' + ', array_column($rewards, 'label'));
    begin_transaction(function (PDO $database) use ($user, $code, $rewards, $summary): void {
        foreach ($rewards as $reward) {
            $amount = (int) $reward['amount'];
            if ($reward['rewardType'] === 'yuanbao') {
                $database->prepare('UPDATE wallets SET yuanbao = yuanbao + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
                    ->execute([$amount, $user['id']]);
            } elseif ($reward['rewardType'] === 'points') {
                $database->prepare('UPDATE point_accounts SET points = points + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
                    ->execute([$amount, $user['id']]);
            } elseif ($reward['rewardType'] === 'collection' && $reward['collectionId']) {
                $collection = $database->prepare("SELECT sold, total FROM collections WHERE id = ? AND status = 'on_sale'");
                $collection->execute([$reward['collectionId']]);
                $row = $collection->fetch();
                if (!$row || (int) $row['sold'] >= (int) $row['total']) throw new ApiException('礼包中的藏品已领完');
                $serial = (int) $row['sold'] + 1;
                $database->prepare('UPDATE collections SET sold = sold + 1 WHERE id = ? AND sold < total')->execute([$reward['collectionId']]);
                $database->prepare('INSERT INTO user_collections (id, user_id, collection_id, serial_no, source, status) VALUES (?, ?, ?, ?, ?, ?)')
                    ->execute([uuid(), $user['id'], $reward['collectionId'], $serial, '兑换码', 'normal']);
            }
        }
        $database->prepare('UPDATE redeem_codes SET used_count = used_count + 1 WHERE id = ?')->execute([$code['id']]);
        $database->prepare('INSERT INTO redeem_records (id, user_id, redeem_code_id, code_snapshot, reward_summary) VALUES (?, ?, ?, ?, ?)')
            ->execute([uuid(), $user['id'], $code['id'], $code['code'], $summary]);
    });
    json_response(['success' => true, 'message' => '兑换成功：' . $summary, 'reward' => $summary]);
}

function check_in(array $user): never
{
    $today = shanghai_date();
    if ($user['lastCheckinDate'] === $today) throw new ApiException('今天已经签到，明天再来吧', 409);
    $continued = $user['lastCheckinDate'] === shanghai_date(-1);
    $streak = $continued ? ((int) $user['streak'] >= 7 ? 1 : (int) $user['streak'] + 1) : 1;
    $reward = $streak * 10;
    begin_transaction(function (PDO $database) use ($user, $today, $streak, $reward): void {
        $database->prepare('INSERT INTO checkin_records (id, user_id, checkin_date, reward_points, streak_day) VALUES (?, ?, ?, ?, ?)')
            ->execute([uuid(), $user['id'], $today, $reward, $streak]);
        $database->prepare('UPDATE point_accounts SET points = points + ?, streak = ?, last_checkin_date = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
            ->execute([$reward, $streak, $today, $user['id']]);
    });
    json_response(['success' => true, 'message' => "签到成功，积分 +{$reward}", 'reward' => $reward, 'streak' => $streak]);
}

function purchase(array $user): never
{
    $input = body();
    $collectionId = (string) ($input['collectionId'] ?? '');
    $currency = (string) ($input['currency'] ?? 'yuanbao');
    if (!in_array($currency, ['yuanbao', 'points'], true)) {
        throw new ApiException('兑换方式不正确');
    }

    $statement = db()->prepare(
        'SELECT id, name, price, points_price AS pointsPrice, redeem_mode AS redeemMode, sold, total, status
         FROM collections WHERE id = ?'
    );
    $statement->execute([$collectionId]);
    $collection = $statement->fetch();
    if (!$collection || $collection['status'] !== 'on_sale') throw new ApiException('藏品当前不可兑换', 404);

    $names = currency_names();
    $mode = (string) $collection['redeemMode'];
    if ($mode === 'none') throw new ApiException('该藏品暂不支持兑换');
    if ($currency === 'points' && $mode === 'yuanbao') {
        throw new ApiException('该藏品仅支持' . $names['yuanbao'] . '兑换');
    }
    if ($currency === 'yuanbao' && $mode === 'points') {
        throw new ApiException('该藏品仅支持' . $names['points'] . '兑换');
    }

    $price = $currency === 'points' ? (int) $collection['pointsPrice'] : (int) $collection['price'];
    if ($price <= 0) throw new ApiException('该藏品暂不支持该兑换方式');

    $balance = $currency === 'points' ? (int) $user['points'] : (int) $user['yuanbao'];
    $label = $currency === 'points' ? $names['points'] : $names['yuanbao'];
    if ($balance < $price) throw new ApiException($label . '余额不足');
    if ((int) $collection['sold'] >= (int) $collection['total']) throw new ApiException('藏品已经兑完');

    $serial = (int) $collection['sold'] + 1;
    $instanceId = uuid();
    $source = $currency === 'points' ? $names['points'] . '兑换' : $names['yuanbao'] . '兑换';
    begin_transaction(function (PDO $database) use ($user, $collection, $serial, $instanceId, $currency, $price, $balance, $source): void {
        if ($currency === 'points') {
            $database->prepare('UPDATE point_accounts SET points = points - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND points >= ?')
                ->execute([$price, $user['id'], $price]);
        } else {
            $database->prepare('UPDATE wallets SET yuanbao = yuanbao - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND yuanbao >= ?')
                ->execute([$price, $user['id'], $price]);
        }
        $database->prepare('UPDATE collections SET sold = sold + 1 WHERE id = ? AND sold < total')->execute([$collection['id']]);
        $database->prepare('INSERT INTO user_collections (id, user_id, collection_id, serial_no, source, status) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$instanceId, $user['id'], $collection['id'], $serial, $source, 'normal']);
        $database->prepare('INSERT INTO wallet_transactions (id, user_id, kind, amount, balance_after, reference_type, reference_id, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([uuid(), $user['id'], 'purchase', -$price, $balance - $price, 'collection', $collection['id'], $source . '：' . $collection['name']]);
    });
    json_response([
        'success' => true,
        'message' => '已用' . $label . '收藏「' . $collection['name'] . '」',
        'instanceId' => $instanceId,
        'serialNo' => $serial,
    ]);
}

function create_transfer(array $user): never
{
    $input = body();
    $ownedId = (string) ($input['userCollectionId'] ?? '');
    $recipientUsername = strtolower(trim((string) ($input['recipientUsername'] ?? '')));
    $price = integer_value($input['price'] ?? 0, 0, 10000000, '转让价格');
    if ($ownedId === '' || $recipientUsername === '') throw new ApiException('请填写受让方和藏品');
    $ownedQuery = db()->prepare(
        'SELECT uc.id, uc.collection_id AS collectionId, uc.status, c.name, c.transferable
         FROM user_collections uc JOIN collections c ON c.id = uc.collection_id
         WHERE uc.id = ? AND uc.user_id = ?'
    );
    $ownedQuery->execute([$ownedId, $user['id']]);
    $owned = $ownedQuery->fetch();
    if (!$owned) throw new ApiException('未找到该藏品', 404);
    if (!(bool) $owned['transferable']) throw new ApiException('该藏品不支持转让');
    if ($owned['status'] !== 'normal') throw new ApiException('藏品正在其他流程中');
    $recipientQuery = db()->prepare("SELECT id, username FROM users WHERE username = ? COLLATE NOCASE AND status = 'active'");
    $recipientQuery->execute([$recipientUsername]);
    $recipient = $recipientQuery->fetch();
    if (!$recipient) throw new ApiException('未找到受让方用户', 404);
    if ($recipient['id'] === $user['id']) throw new ApiException('不能转让给自己');
    $orderId = uuid();
    $fee = (int) floor($price * 0.05);
    begin_transaction(function (PDO $database) use ($owned, $recipient, $user, $price, $fee, $orderId): void {
        $database->prepare("UPDATE user_collections SET status = 'transferring' WHERE id = ? AND status = 'normal'")->execute([$owned['id']]);
        $database->prepare('INSERT INTO transfers (id, sender_user_id, recipient_username, recipient_user_id, user_collection_id, collection_id, price, fee, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$orderId, $user['id'], $recipient['username'], $recipient['id'], $owned['id'], $owned['collectionId'], $price, $fee, 'pending']);
    });
    json_response(['success' => true, 'message' => '已向 ' . $recipient['username'] . ' 发起「' . $owned['name'] . '」转让', 'orderId' => $orderId]);
}

function update_transfer(array $user): never
{
    $input = body();
    $orderId = (string) ($input['orderId'] ?? '');
    $action = (string) ($input['action'] ?? '');
    $query = db()->prepare(
        'SELECT t.id, t.sender_user_id AS senderUserId, t.recipient_user_id AS recipientUserId,
                t.user_collection_id AS userCollectionId, t.price, t.fee, t.status, c.name
         FROM transfers t JOIN collections c ON c.id = t.collection_id WHERE t.id = ?'
    );
    $query->execute([$orderId]);
    $order = $query->fetch();
    if (!$order) throw new ApiException('转让单不存在', 404);
    if ($order['status'] !== 'pending') throw new ApiException('该转让单已经处理');
    if ($action === 'cancel') {
        if ($order['senderUserId'] !== $user['id']) throw new ApiException('只能撤销自己发起的转让', 403);
        begin_transaction(function (PDO $database) use ($order): void {
            $database->prepare("UPDATE transfers SET status = 'cancelled' WHERE id = ?")->execute([$order['id']]);
            $database->prepare("UPDATE user_collections SET status = 'normal' WHERE id = ?")->execute([$order['userCollectionId']]);
        });
        json_response(['success' => true, 'message' => '转让已撤销']);
    }
    if ($order['recipientUserId'] !== $user['id']) throw new ApiException('只能处理发给自己的转让', 403);
    if ($action === 'reject') {
        begin_transaction(function (PDO $database) use ($order): void {
            $database->prepare("UPDATE transfers SET status = 'rejected' WHERE id = ?")->execute([$order['id']]);
            $database->prepare("UPDATE user_collections SET status = 'normal' WHERE id = ?")->execute([$order['userCollectionId']]);
        });
        json_response(['success' => true, 'message' => '已拒绝转让']);
    }
    if ($action !== 'accept') throw new ApiException('不支持的转让操作');
    if ((int) $user['yuanbao'] < (int) $order['price']) throw new ApiException('元宝余额不足，无法接收');
    begin_transaction(function (PDO $database) use ($order, $user): void {
        $sellerIncome = (int) $order['price'] - (int) $order['fee'];
        $database->prepare("UPDATE user_collections SET user_id = ?, status = 'normal', acquired_at = CURRENT_TIMESTAMP WHERE id = ?")
            ->execute([$user['id'], $order['userCollectionId']]);
        $database->prepare("UPDATE transfers SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$order['id']]);
        if ((int) $order['price'] > 0) {
            $database->prepare('UPDATE wallets SET yuanbao = yuanbao - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')->execute([$order['price'], $user['id']]);
            $database->prepare('UPDATE wallets SET yuanbao = yuanbao + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')->execute([$sellerIncome, $order['senderUserId']]);
        }
    });
    json_response(['success' => true, 'message' => '已接收「' . $order['name'] . '」']);
}

/**
 * 转让单详情：用户端详情页与后台查看详情共用。
 */
function transfer_detail(string $orderId, array $user): array
{
    $query = db()->prepare(
        "SELECT t.id, t.sender_user_id AS senderUserId, t.recipient_user_id AS recipientUserId,
                t.user_collection_id AS userCollectionId, t.collection_id AS collectionId,
                t.price, t.fee, t.status, t.created_at AS createdAt, t.completed_at AS completedAt,
                c.name, c.rarity, c.image_url AS imageUrl, c.transferable,
                uc.serial_no AS serialNo, uc.source,
                su.username AS senderUsername, su.display_name AS senderDisplayName,
                ru.username AS recipientUsername, ru.display_name AS recipientDisplayName
         FROM transfers t
         JOIN collections c ON c.id = t.collection_id
         JOIN user_collections uc ON uc.id = t.user_collection_id
         JOIN users su ON su.id = t.sender_user_id
         LEFT JOIN users ru ON ru.id = t.recipient_user_id
         WHERE t.id = ?"
    );
    $query->execute([$orderId]);
    $order = $query->fetch();
    if (!$order) {
        throw new ApiException('转让单不存在', 404);
    }

    $isAdmin = ($user['role'] ?? 'user') === 'admin';
    $isSender = $order['senderUserId'] === $user['id'];
    $isRecipient = $order['recipientUserId'] === $user['id'];
    if (!$isAdmin && !$isSender && !$isRecipient) {
        throw new ApiException('无权查看该转让单', 403);
    }

    $pending = $order['status'] === 'pending';
    return [
        'id' => $order['id'],
        'status' => $order['status'],
        'price' => (int) $order['price'],
        'fee' => (int) $order['fee'],
        'createdAt' => $order['createdAt'],
        'completedAt' => $order['completedAt'],
        'serialNo' => (int) $order['serialNo'],
        'source' => $order['source'],
        'collection' => [
            'id' => $order['collectionId'],
            'name' => $order['name'],
            'rarity' => $order['rarity'],
            'imageUrl' => $order['imageUrl'],
            'transferable' => (bool) $order['transferable'],
        ],
        'sender' => [
            'id' => $order['senderUserId'],
            'username' => $order['senderUsername'],
            'displayName' => $order['senderDisplayName'],
        ],
        'recipient' => [
            'id' => $order['recipientUserId'],
            'username' => $order['recipientUsername'],
            'displayName' => $order['recipientDisplayName'],
        ],
        'isSender' => $isSender,
        'isRecipient' => $isRecipient,
        'canAccept' => $isRecipient && $pending,
        'canReject' => $isRecipient && $pending,
        'canCancel' => $isSender && $pending,
        'names' => currency_names(),
    ];
}

/**
 * 后台上传藏品素材：保存到 COLLECTIBLES_MEDIA_DIR（缺省 public/media/collections）并返回可访问的 URL。
 */
function admin_upload(array $admin): never
{
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        throw new ApiException('请选择要上传的图片文件');
    }
    if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
        $uploadErrors = [
            UPLOAD_ERR_INI_SIZE => '图片超过服务器上传限制（最大 8MB）',
            UPLOAD_ERR_FORM_SIZE => '图片超过表单限制（最大 8MB）',
            UPLOAD_ERR_PARTIAL => '文件上传中断，请重试',
            UPLOAD_ERR_NO_TMP_DIR => '服务器缺少临时目录，请联系管理员',
            UPLOAD_ERR_CANT_WRITE => '服务器写入失败，请联系管理员',
            UPLOAD_ERR_EXTENSION => '上传被服务器扩展拦截',
        ];
        throw new ApiException($uploadErrors[$file['error']] ?? '文件上传失败，请重试');
    }
    if (($file['size'] ?? 0) > 8 * 1024 * 1024) {
        throw new ApiException('图片不能超过 8MB');
    }
    if (($file['size'] ?? 0) === 0) {
        throw new ApiException('图片内容为空，请重新选择');
    }

    $allowed = ['gif' => 'image/gif', 'png' => 'image/png', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'webp' => 'image/webp'];
    $extension = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
    if (!isset($allowed[$extension])) {
        throw new ApiException('仅支持 GIF、PNG、JPG、WEBP 格式的图片');
    }

    $detected = @getimagesize((string) $file['tmp_name']);
    $detectedType = is_array($detected) ? (string) $detected['mime'] : '';
    if ($detectedType !== '' && $detectedType !== $allowed[$extension]) {
        throw new ApiException('文件内容与扩展名不一致');
    }

    $configuredMedia = getenv('COLLECTIBLES_MEDIA_DIR');
    $directory = $configuredMedia !== false && $configuredMedia !== ''
        ? $configuredMedia
        : project_root() . '/public/media/collections';
    if (!is_dir($directory) && !mkdir($directory, 0775, true) && !is_dir($directory)) {
        throw new ApiException('无法创建素材目录');
    }

    $filename = 'c_' . bin2hex(random_bytes(8)) . '.' . $extension;
    $target = $directory . '/' . $filename;
    if (!move_uploaded_file((string) $file['tmp_name'], $target)) {
        throw new ApiException('保存文件失败，请检查目录权限');
    }

    json_response([
        'success' => true,
        'message' => '素材已上传',
        'url' => '/media/collections/' . $filename,
    ]);
}

/**
 * 兑换码使用明细：哪个用户在什么时候兑换了什么。
 */
function code_usage(string $codeId): array
{    $codeQuery = db()->prepare(
        'SELECT id, code, title, kind, status, max_total AS maxTotal, max_per_user AS maxPerUser,
                used_count AS usedCount, created_at AS createdAt
         FROM redeem_codes WHERE id = ?'
    );
    $codeQuery->execute([$codeId]);
    $code = $codeQuery->fetch();
    if (!$code) {
        throw new ApiException('兑换码不存在', 404);
    }

    $recordsQuery = db()->prepare(
        'SELECT rr.id, rr.code_snapshot AS code, rr.reward_summary AS reward, rr.created_at AS createdAt,
                u.id AS userId, u.username, u.display_name AS displayName
         FROM redeem_records rr JOIN users u ON u.id = rr.user_id
         WHERE rr.redeem_code_id = ? ORDER BY rr.created_at DESC'
    );
    $recordsQuery->execute([$codeId]);

    return [
        'code' => [
            'id' => $code['id'],
            'code' => $code['code'],
            'title' => $code['title'],
            'kind' => $code['kind'],
            'status' => $code['status'],
            'maxTotal' => (int) $code['maxTotal'],
            'maxPerUser' => (int) $code['maxPerUser'],
            'usedCount' => (int) $code['usedCount'],
            'createdAt' => $code['createdAt'],
        ],
        'records' => $recordsQuery->fetchAll(),
    ];
}

function admin_user_detail(string $userId): array
{
    $database = db();
    $userQuery = $database->prepare(
        'SELECT u.id, u.username, u.display_name AS displayName, u.role, u.status,
                u.created_at AS createdAt, w.yuanbao, p.points
         FROM users u
         JOIN wallets w ON w.user_id = u.id
         JOIN point_accounts p ON p.user_id = u.id
         WHERE u.id = ?'
    );
    $userQuery->execute([$userId]);
    $user = $userQuery->fetch();
    if (!$user) {
        throw new ApiException('用户不存在', 404);
    }

    $holdingsStatement = $database->prepare(
        "SELECT uc.id, uc.collection_id AS collectionId, uc.serial_no AS serialNo,
                uc.source, uc.status, uc.acquired_at AS acquiredAt,
                c.name, c.rarity, c.image_url AS imageUrl, c.transferable
         FROM user_collections uc
         JOIN collections c ON c.id = uc.collection_id
         WHERE uc.user_id = ? ORDER BY uc.acquired_at DESC"
    );
    $holdingsStatement->execute([$userId]);
    $holdings = $holdingsStatement->fetchAll();
    foreach ($holdings as &$holding) {
        $holding['transferable'] = (bool) $holding['transferable'];
    }
    unset($holding);

    $recordsStatement = $database->prepare(
        'SELECT code_snapshot AS code, reward_summary AS reward, created_at AS createdAt
         FROM redeem_records WHERE user_id = ? ORDER BY created_at DESC'
    );
    $recordsStatement->execute([$userId]);

    $transferStatement = $database->prepare(
        "SELECT t.id, t.sender_user_id AS senderUserId, t.recipient_user_id AS recipientUserId,
                t.recipient_username AS recipientUsername, t.user_collection_id AS userCollectionId,
                t.collection_id AS collectionId, t.price, t.fee, t.status, t.created_at AS createdAt,
                c.name, c.rarity, c.image_url AS imageUrl,
                sender.username AS senderUsername, sender.display_name AS senderDisplayName
         FROM transfers t
         JOIN collections c ON c.id = t.collection_id
         JOIN users sender ON sender.id = t.sender_user_id
         WHERE t.sender_user_id = ? OR t.recipient_user_id = ?
         ORDER BY t.created_at DESC LIMIT 50"
    );
    $transferStatement->execute([$userId, $userId]);

    return [
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'displayName' => $user['displayName'],
            'role' => $user['role'],
            'status' => $user['status'],
            'createdAt' => $user['createdAt'],
        ],
        'assets' => [
            'yuanbao' => (int) $user['yuanbao'],
            'points' => (int) $user['points'],
        ],
        'holdings' => $holdings,
        'redeemRecords' => $recordsStatement->fetchAll(),
        'transfers' => $transferStatement->fetchAll(),
    ];
}

function admin_action(array $admin): never
{
    $input = body();
    $action = (string) ($input['action'] ?? '');
    if ($action === 'collection.update') {
        $names = currency_names();
        $price = integer_value($input['price'] ?? null, 0, 10000000, $names['yuanbao'] . '价格');
        $pointsPrice = integer_value($input['pointsPrice'] ?? 0, 0, 10000000, $names['points'] . '价格');
        $status = (string) ($input['status'] ?? '');
        $redeemMode = (string) ($input['redeemMode'] ?? '');
        if (!in_array($status, ['on_sale', 'off_sale', 'archived'], true)) throw new ApiException('藏品状态不正确');
        if (!in_array($redeemMode, ['both', 'yuanbao', 'points', 'none'], true)) throw new ApiException('兑换方式不正确');
        if ($redeemMode !== 'yuanbao' && $pointsPrice <= 0) {
            throw new ApiException('请使用' . $names['points'] . '兑换时填写大于 0 的' . $names['points'] . '价');
        }

        $exists = db()->prepare('SELECT id, name, subtitle, description, rarity, total, sold, image_url AS imageUrl FROM collections WHERE id = ?');
        $exists->execute([$input['collectionId'] ?? '']);
        $current = $exists->fetch();
        if (!$current) {
            throw new ApiException('藏品不存在', 404);
        }

        $name = trim((string) ($input['name'] ?? '')) ?: (string) $current['name'];
        if (mb_strlen($name) > 30) {
            throw new ApiException('藏品名称需为 1–30 个字');
        }
        $subtitle = trim((string) ($input['subtitle'] ?? '')) ?: (string) $current['subtitle'];
        $description = trim((string) ($input['description'] ?? '')) ?: (string) $current['description'];
        $rarity = trim((string) ($input['rarity'] ?? '')) ?: (string) $current['rarity'];
        if (!in_array($rarity, COLLECTION_RARITIES, true)) {
            throw new ApiException('稀有度不正确');
        }
        $total = (int) ($input['total'] ?? $current['total']);
        if ($total < 1) {
            throw new ApiException('发行总量需大于 0');
        }
        if ($total < (int) $current['sold']) {
            throw new ApiException('发行总量不能小于已发行数量');
        }

        // 未重新上传素材时保留原图，避免每次保存都被重置成默认 GIF。
        $imageUrl = trim((string) ($input['imageUrl'] ?? ''));
        if ($imageUrl !== '' && !str_starts_with($imageUrl, '/media/')) {
            throw new ApiException('藏品图片地址不正确');
        }
        if ($imageUrl === '') {
            $imageUrl = (string) $current['imageUrl'];
        }

        $statement = db()->prepare(
            'UPDATE collections SET name = ?, subtitle = ?, description = ?, rarity = ?, total = ?,
                    price = ?, points_price = ?, redeem_mode = ?, status = ?, transferable = ?, image_url = ?
             WHERE id = ?'
        );
        $statement->execute([
            $name,
            $subtitle,
            $description,
            $rarity,
            $total,
            $price,
            $pointsPrice,
            $redeemMode,
            $status,
            !empty($input['transferable']) ? 1 : 0,
            $imageUrl,
            $input['collectionId'] ?? '',
        ]);
        record_audit(
            $admin,
            'collection.update',
            $name,
            sprintf(
                '%s｜%s %d｜%s %d｜%s',
                $rarity,
                $names['yuanbao'],
                $price,
                $names['points'],
                $pointsPrice,
                $status === 'on_sale' ? '上架中' : ($status === 'off_sale' ? '已下架' : '已归档')
            )
        );
        json_response(['success' => true, 'message' => '藏品设置已保存']);
    }
    if ($action === 'collection.create') {
        $names = currency_names();
        $name = trim((string) ($input['name'] ?? ''));
        $subtitle = trim((string) ($input['subtitle'] ?? ''));
        $description = trim((string) ($input['description'] ?? ''));
        $rarity = trim((string) ($input['rarity'] ?? ''));
        if ($name === '' || mb_strlen($name) > 30) {
            throw new ApiException('请填写 1–30 字的藏品名称');
        }
        if ($description === '' || mb_strlen($description) > 500) {
            throw new ApiException('请填写 1–500 字的藏品介绍');
        }
        if (!in_array($rarity, COLLECTION_RARITIES, true)) {
            throw new ApiException('请选择藏品稀有度');
        }
        $price = integer_value($input['price'] ?? 0, 0, 10000000, $names['yuanbao'] . '价格');
        $pointsPrice = integer_value($input['pointsPrice'] ?? 0, 0, 10000000, $names['points'] . '价格');
        $redeemMode = (string) ($input['redeemMode'] ?? '');
        $status = (string) ($input['status'] ?? 'on_sale');
        if (!in_array($redeemMode, ['both', 'yuanbao', 'points', 'none'], true)) {
            throw new ApiException('兑换方式不正确');
        }
        if (!in_array($status, ['on_sale', 'off_sale', 'archived'], true)) {
            throw new ApiException('藏品状态不正确');
        }
        if ($redeemMode !== 'yuanbao' && $pointsPrice <= 0) {
            throw new ApiException('请使用' . $names['points'] . '兑换时填写大于 0 的' . $names['points'] . '价');
        }
        if ($redeemMode !== 'points' && $price <= 0) {
            throw new ApiException('请使用' . $names['yuanbao'] . '兑换时填写大于 0 的' . $names['yuanbao'] . '价');
        }
        $total = integer_value($input['total'] ?? 1000, 1, 100000000, '发行总量');

        $imageUrl = trim((string) ($input['imageUrl'] ?? ''));
        if ($imageUrl !== '' && !str_starts_with($imageUrl, '/media/')) {
            throw new ApiException('藏品图片地址不正确');
        }
        if ($imageUrl === '') {
            $imageUrl = '/media/change.gif';
        }

        $collectionId = 'c_' . bin2hex(random_bytes(6));
        db()->prepare(
            'INSERT INTO collections
             (id, name, subtitle, description, rarity, price, points_price, redeem_mode, total, sold, transferable, image_url, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)'
        )->execute([
            $collectionId,
            $name,
            $subtitle,
            $description,
            $rarity,
            $price,
            $pointsPrice,
            $redeemMode,
            $total,
            !empty($input['transferable']) ? 1 : 0,
            $imageUrl,
            $status,
        ]);
        record_audit(
            $admin,
            'collection.create',
            $name,
            sprintf('%s｜发行 %d｜%s', $rarity, $total, $status === 'on_sale' ? '上架' : '未上架')
        );
        json_response(['success' => true, 'message' => '藏品「' . $name . '」已创建', 'collectionId' => $collectionId], 201);
    }
    if ($action === 'settings.update') {
        $yuanbaoName = trim((string) ($input['yuanbaoName'] ?? ''));
        $pointsName = trim((string) ($input['pointsName'] ?? ''));
        if ($yuanbaoName === '' || mb_strlen($yuanbaoName) > 8) throw new ApiException('货币名称需为 1–8 个字');
        if ($pointsName === '' || mb_strlen($pointsName) > 8) throw new ApiException('货币名称需为 1–8 个字');
        if ($yuanbaoName === $pointsName) throw new ApiException('两种货币不能使用相同名称');
        begin_transaction(function (PDO $database) use ($yuanbaoName, $pointsName): void {
            $save = $database->prepare(
                'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
            );
            $save->execute(['yuanbao_name', $yuanbaoName]);
            $save->execute(['points_name', $pointsName]);
        });
        record_audit($admin, 'settings.update', '货币名称', "{$yuanbaoName} / {$pointsName}");
        json_response(['success' => true, 'message' => '货币名称已更新']);
    }
    if ($action === 'banner.create' || $action === 'banner.update') {
        $title = trim((string) ($input['title'] ?? ''));
        $imageUrl = trim((string) ($input['imageUrl'] ?? ''));
        $link = trim((string) ($input['link'] ?? ''));
        $sortOrder = integer_value($input['sortOrder'] ?? 0, 0, 999, '排序值');
        if ($title === '' || mb_strlen($title) > 30) throw new ApiException('横幅标题需为 1–30 个字');
        if ($imageUrl === '' || strlen($imageUrl) > 500) throw new ApiException('请填写有效的图片地址');
        if (strlen($link) > 300) throw new ApiException('跳转链接过长');

        if ($action === 'banner.create') {
            db()->prepare('INSERT INTO banners (id, title, image_url, link, sort_order, status) VALUES (?, ?, ?, ?, ?, ?)')
                ->execute([uuid(), $title, $imageUrl, $link === '' ? null : $link, $sortOrder, 'active']);
            record_audit($admin, 'banner.create', $title, '首页横幅');
            json_response(['success' => true, 'message' => '横幅已添加'], 201);
        }

        $bannerId = (string) ($input['bannerId'] ?? '');
        $status = (string) ($input['status'] ?? 'active');
        if (!in_array($status, ['active', 'disabled'], true)) throw new ApiException('横幅状态不正确');
        $statement = db()->prepare('UPDATE banners SET title = ?, image_url = ?, link = ?, sort_order = ?, status = ? WHERE id = ?');
        $statement->execute([$title, $imageUrl, $link === '' ? null : $link, $sortOrder, $status, $bannerId]);
        if ($statement->rowCount() === 0) throw new ApiException('横幅不存在', 404);
        record_audit($admin, 'banner.update', $title, $status === 'active' ? '启用中' : '已停用');
        json_response(['success' => true, 'message' => '横幅已保存']);
    }
    if ($action === 'banner.delete') {
        $bannerId = (string) ($input['bannerId'] ?? '');
        $bannerTitleQuery = db()->prepare('SELECT title FROM banners WHERE id = ?');
        $bannerTitleQuery->execute([$bannerId]);
        $bannerTitle = (string) $bannerTitleQuery->fetchColumn();
        $statement = db()->prepare('DELETE FROM banners WHERE id = ?');
        $statement->execute([$bannerId]);
        if ($statement->rowCount() === 0) throw new ApiException('横幅不存在', 404);
        record_audit($admin, 'banner.delete', $bannerTitle !== '' ? $bannerTitle : $bannerId, '首页横幅');
        json_response(['success' => true, 'message' => '横幅已删除']);
    }
    if ($action === 'code.create') {
        $code = strtoupper(trim((string) ($input['code'] ?? '')));
        $title = trim((string) ($input['title'] ?? ''));
        if (!preg_match('/^[A-Z0-9-]{4,32}$/', $code)) throw new ApiException('兑换码需为 4–32 位大写字母、数字或短横线');
        if ($title === '' || mb_strlen($title) > 40) throw new ApiException('请填写 1–40 字的礼包名称');
        $yuanbao = integer_value($input['yuanbao'] ?? 0, 0, 10000000, '元宝奖励');
        $points = integer_value($input['points'] ?? 0, 0, 10000000, '积分奖励');
        $maxTotal = integer_value($input['maxTotal'] ?? 100, 1, 100000, '总使用次数');
        $collectionId = trim((string) ($input['collectionId'] ?? ''));
        if ($yuanbao === 0 && $points === 0 && $collectionId === '') throw new ApiException('至少配置一种奖励');
        begin_transaction(function (PDO $database) use ($code, $title, $yuanbao, $points, $maxTotal, $collectionId): void {
            $codeId = uuid();
            $database->prepare('INSERT INTO redeem_codes (id, code, title, kind, status, max_total, max_per_user, used_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$codeId, $code, $title, 'general', 'active', $maxTotal, 1, 0]);
            $reward = $database->prepare('INSERT INTO redeem_code_rewards (id, redeem_code_id, reward_type, amount, collection_id, label) VALUES (?, ?, ?, ?, ?, ?)');
            if ($yuanbao > 0) $reward->execute([uuid(), $codeId, 'yuanbao', $yuanbao, null, "元宝 × {$yuanbao}"]);
            if ($points > 0) $reward->execute([uuid(), $codeId, 'points', $points, null, "积分 × {$points}"]);
            if ($collectionId !== '') {
                $collection = $database->prepare('SELECT name FROM collections WHERE id = ?');
                $collection->execute([$collectionId]);
                $name = $collection->fetchColumn();
                if (!$name) throw new ApiException('奖励藏品不存在', 404);
                $reward->execute([uuid(), $codeId, 'collection', 1, $collectionId, $name . ' × 1']);
            }
        });
        $rewardSummary = [];
        if ($yuanbao > 0) $rewardSummary[] = "元宝 ×{$yuanbao}";
        if ($points > 0) $rewardSummary[] = "积分 ×{$points}";
        if ($collectionId !== '') $rewardSummary[] = '藏品 ×1';
        record_audit($admin, 'code.create', $code, $title . ($rewardSummary !== [] ? '｜' . implode('、', $rewardSummary) : ''));
        json_response(['success' => true, 'message' => "兑换码 {$code} 已创建"]);
    }
    if ($action === 'code.generate') {
        $title = trim((string) ($input['title'] ?? ''));
        if ($title === '' || mb_strlen($title) > 40) throw new ApiException('请填写 1–40 字的礼包名称');
        $quantity = integer_value($input['quantity'] ?? 1, 1, 200, '生成数量');
        $yuanbao = integer_value($input['yuanbao'] ?? 0, 0, 10000000, '元宝奖励');
        $points = integer_value($input['points'] ?? 0, 0, 10000000, '积分奖励');
        $collectionId = trim((string) ($input['collectionId'] ?? ''));
        if ($yuanbao === 0 && $points === 0 && $collectionId === '') throw new ApiException('至少配置一种奖励');

        $rewardName = '';
        if ($collectionId !== '') {
            $collectionQuery = db()->prepare('SELECT name FROM collections WHERE id = ?');
            $collectionQuery->execute([$collectionId]);
            $rewardName = (string) $collectionQuery->fetchColumn();
            if ($rewardName === '') throw new ApiException('奖励藏品不存在', 404);
        }

        $generated = [];
        begin_transaction(function (PDO $database) use ($title, $quantity, $yuanbao, $points, $collectionId, $rewardName, &$generated): void {
            $codeInsert = $database->prepare(
                'INSERT INTO redeem_codes (id, code, title, kind, status, max_total, max_per_user, used_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $rewardInsert = $database->prepare(
                'INSERT INTO redeem_code_rewards (id, redeem_code_id, reward_type, amount, collection_id, label) VALUES (?, ?, ?, ?, ?, ?)'
            );
            $existsQuery = $database->prepare('SELECT id FROM redeem_codes WHERE code = ?');

            for ($index = 0; $index < $quantity; $index++) {
                do {
                    $code = implode('-', str_split(random_code(12), 4));
                    $existsQuery->execute([$code]);
                } while ($existsQuery->fetch());

                $codeId = uuid();
                $codeInsert->execute([$codeId, $code, $title, 'once', 'active', 1, 1, 0]);
                if ($yuanbao > 0) {
                    $rewardInsert->execute([uuid(), $codeId, 'yuanbao', $yuanbao, null, "元宝 × {$yuanbao}"]);
                }
                if ($points > 0) {
                    $rewardInsert->execute([uuid(), $codeId, 'points', $points, null, "积分 × {$points}"]);
                }
                if ($collectionId !== '') {
                    $rewardInsert->execute([uuid(), $codeId, 'collection', 1, $collectionId, $rewardName . ' × 1']);
                }
                $generated[] = $code;
            }
        });
        record_audit($admin, 'code.generate', $title, "生成 {$quantity} 个一次性兑换码");
        json_response([
            'success' => true,
            'message' => "已生成 {$quantity} 个一次性兑换码",
            'codes' => $generated,
        ], 201);
    }
    if ($action === 'code.toggle') {
        $status = (string) ($input['status'] ?? '');
        if (!in_array($status, ['active', 'disabled'], true)) throw new ApiException('兑换码状态不正确');
        $codeRowQuery = db()->prepare('SELECT code, title FROM redeem_codes WHERE id = ?');
        $codeRowQuery->execute([$input['codeId'] ?? '']);
        $codeRow = $codeRowQuery->fetch();
        if (!$codeRow) throw new ApiException('兑换码不存在', 404);
        db()->prepare('UPDATE redeem_codes SET status = ? WHERE id = ?')->execute([$status, $input['codeId'] ?? '']);
        record_audit(
            $admin,
            'code.toggle',
            (string) $codeRow['code'],
            ($status === 'active' ? '启用' : '停用') . '｜' . (string) $codeRow['title']
        );
        json_response(['success' => true, 'message' => $status === 'active' ? '兑换码已启用' : '兑换码已停用']);
    }
    if ($action === 'code.delete') {
        $codeId = (string) ($input['codeId'] ?? '');
        $codeRowQuery = db()->prepare('SELECT code, title, used_count AS usedCount FROM redeem_codes WHERE id = ?');
        $codeRowQuery->execute([$codeId]);
        $codeRow = $codeRowQuery->fetch();
        if (!$codeRow) throw new ApiException('兑换码不存在', 404);
        $usedCount = (int) $codeRow['usedCount'];
        begin_transaction(function (PDO $database) use ($codeId): void {
            // 先清该码的使用记录，避免外键约束阻塞；奖励与钱包发放不受影响
            $database->prepare('DELETE FROM redeem_records WHERE redeem_code_id = ?')->execute([$codeId]);
            // redeem_code_rewards 通过 ON DELETE CASCADE 一并清理
            $database->prepare('DELETE FROM redeem_codes WHERE id = ?')->execute([$codeId]);
        });
        $detail = '删除兑换码｜' . (string) $codeRow['title'];
        if ($usedCount > 0) {
            $detail .= "｜已使用 {$usedCount} 次，连带移除对应使用记录";
        }
        record_audit($admin, 'code.delete', (string) $codeRow['code'], $detail);
        json_response(['success' => true, 'message' => '兑换码已删除']);
    }
    if ($action === 'wallet.adjust') {
        $username = strtolower(trim((string) ($input['username'] ?? '')));
        $yuanbaoDelta = integer_value($input['yuanbaoDelta'] ?? 0, -10000000, 10000000, '元宝调整值');
        $pointsDelta = integer_value($input['pointsDelta'] ?? 0, -10000000, 10000000, '积分调整值');
        $targetQuery = db()->prepare('SELECT u.id, w.yuanbao, p.points FROM users u JOIN wallets w ON w.user_id = u.id JOIN point_accounts p ON p.user_id = u.id WHERE u.username = ? COLLATE NOCASE');
        $targetQuery->execute([$username]);
        $target = $targetQuery->fetch();
        if (!$target) throw new ApiException('用户不存在', 404);
        if ((int) $target['yuanbao'] + $yuanbaoDelta < 0 || (int) $target['points'] + $pointsDelta < 0) throw new ApiException('调整后余额不能为负数');
        begin_transaction(function (PDO $database) use ($target, $yuanbaoDelta, $pointsDelta): void {
            $database->prepare('UPDATE wallets SET yuanbao = yuanbao + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')->execute([$yuanbaoDelta, $target['id']]);
            $database->prepare('UPDATE point_accounts SET points = points + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')->execute([$pointsDelta, $target['id']]);
        });
        $names = currency_names();
        record_audit(
            $admin,
            'wallet.adjust',
            $username,
            sprintf('%s %+d｜%s %+d', $names['yuanbao'], $yuanbaoDelta, $names['points'], $pointsDelta)
        );
        json_response(['success' => true, 'message' => $username . ' 的资产已调整']);
    }
    if ($action === 'user.toggle') {
        $userId = (string) ($input['userId'] ?? '');
        $status = (string) ($input['status'] ?? '');
        if ($userId === $admin['id']) throw new ApiException('不能停用当前管理员');
        if (!in_array($status, ['active', 'disabled'], true)) throw new ApiException('用户状态不正确');
        $targetUserQuery = db()->prepare('SELECT username, display_name AS displayName FROM users WHERE id = ?');
        $targetUserQuery->execute([$userId]);
        $targetUser = $targetUserQuery->fetch();
        if (!$targetUser) throw new ApiException('用户不存在', 404);
        db()->prepare('UPDATE users SET status = ? WHERE id = ?')->execute([$status, $userId]);
        if ($status === 'disabled') db()->prepare('DELETE FROM user_sessions WHERE user_id = ?')->execute([$userId]);
        record_audit($admin, 'user.toggle', (string) $targetUser['displayName'], ($status === 'active' ? '启用账号' : '停用账号') . '｜@' . (string) $targetUser['username']);
        json_response(['success' => true, 'message' => $status === 'active' ? '用户已启用' : '用户已停用']);
    }
    if ($action === 'collection.batch') {
        $status = (string) ($input['status'] ?? '');
        if (!in_array($status, ['on_sale', 'off_sale', 'archived'], true)) throw new ApiException('批量状态不正确');
        $ids = batch_ids($input);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $statement = db()->prepare("UPDATE collections SET status = ? WHERE id IN ({$placeholders})");
        $statement->execute(array_merge([$status], $ids));
        $label = $status === 'on_sale' ? '上架' : ($status === 'off_sale' ? '下架' : '归档');
        record_audit($admin, 'collection.batch', '藏品批量操作', sprintf('批量%s %d 件藏品', $label, (int) $statement->rowCount()));
        json_response(['success' => true, 'message' => sprintf('已%s %d 件藏品', $label, (int) $statement->rowCount())]);
    }
    if ($action === 'user.batch') {
        $status = (string) ($input['status'] ?? '');
        if (!in_array($status, ['active', 'disabled'], true)) throw new ApiException('批量状态不正确');
        $ids = batch_ids($input);
        $ids = array_values(array_filter($ids, static fn (string $id) => $id !== $admin['id']));
        if ($ids === []) throw new ApiException('请选择要操作的用户');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $statement = db()->prepare("UPDATE users SET status = ? WHERE id IN ({$placeholders})");
        $statement->execute(array_merge([$status], $ids));
        if ($status === 'disabled') {
            $sessionStatement = db()->prepare("DELETE FROM user_sessions WHERE user_id IN ({$placeholders})");
            $sessionStatement->execute($ids);
        }
        $label = $status === 'active' ? '启用' : '停用';
        record_audit($admin, 'user.batch', '用户批量操作', sprintf('批量%s %d 个用户', $label, (int) $statement->rowCount()));
        json_response(['success' => true, 'message' => sprintf('已%s %d 个用户', $label, (int) $statement->rowCount())]);
    }
    throw new ApiException('不支持的后台操作');
}

/** 把批量操作的 id 列表归一化：去空、去重、限制 1–200 条。 */
function batch_ids(array $input): array
{
    $ids = $input['ids'] ?? null;
    if (!is_array($ids)) {
        throw new ApiException('请选择要操作的数据');
    }
    $ids = array_values(array_unique(array_filter(array_map('strval', $ids), static fn (string $id): bool => $id !== '')));
    if ($ids === []) {
        throw new ApiException('请选择要操作的数据');
    }
    if (count($ids) > 200) {
        throw new ApiException('单次批量最多 200 条');
    }
    return $ids;
}

try {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($path === '/api/health' && $method === 'GET') {
        json_response(['success' => true, 'runtime' => 'PHP', 'database' => 'SQLite']);
    }
    if ($path === '/api/auth/login' && $method === 'POST') login();
    if ($path === '/api/auth/register' && $method === 'POST') register_user();
    if ($path === '/api/admin/login' && $method === 'POST') admin_login();
    if ($path === '/api/admin/logout' && $method === 'POST') admin_logout();
    if ($path === '/api/auth/logout' && $method === 'POST') {
        if (!empty($_COOKIE['dc_session'])) db()->prepare('DELETE FROM user_sessions WHERE id = ?')->execute([$_COOKIE['dc_session']]);
        setcookie('dc_session', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
        json_response(['success' => true]);
    }
    if ($path === '/api/me' && $method === 'GET') {
        $user = current_user(false);
        json_response(['success' => true, 'user' => $user ? [
            'username' => $user['username'],
            'displayName' => $user['displayName'],
            'role' => $user['role'],
        ] : null]);
    }
    if ($path === '/api/app-state' && $method === 'GET') json_response(['success' => true, 'data' => fetch_app_state(current_user())]);
    if (preg_match('#^/api/collections/([a-z0-9_-]+)$#', $path, $matches) && $method === 'GET') {
        json_response(['success' => true, 'data' => collection_detail($matches[1], current_user())]);
    }
    if ($path === '/api/redeem' && $method === 'POST') redeem_code(current_user());
    if ($path === '/api/check-in' && $method === 'POST') check_in(current_user());
    if ($path === '/api/purchase' && $method === 'POST') purchase(current_user());
    if ($path === '/api/transfers' && $method === 'POST') create_transfer(current_user());
    if ($path === '/api/transfers' && $method === 'PATCH') update_transfer(current_user());
    if ($path === '/api/admin' && $method === 'GET') {
        require_admin();
        json_response(['success' => true, 'data' => admin_overview()]);
    }
    if ($path === '/api/admin' && $method === 'POST') admin_action(require_admin());
    if ($path === '/api/admin/stats' && $method === 'GET') {
        require_admin();
        json_response(['success' => true, 'data' => admin_stats()]);
    }
    if ($path === '/api/admin/audit' && $method === 'GET') {
        require_admin();
        json_response(['success' => true, 'data' => admin_audit_log()]);
    }
    if ($path === '/api/admin/export' && $method === 'GET') {
        require_admin();
        admin_export_csv();
    }
    if ($path === '/api/admin/user' && $method === 'GET') {
        require_admin();
        json_response(['success' => true, 'data' => admin_user_detail((string) ($_GET['id'] ?? ''))]);
    }
    if ($path === '/api/admin/code-usage' && $method === 'GET') {
        require_admin();
        json_response(['success' => true, 'data' => code_usage((string) ($_GET['id'] ?? ''))]);
    }
    if ($path === '/api/admin/upload' && $method === 'POST') {
        admin_upload(require_admin());
    }
    if ($path === '/api/rankings' && $method === 'GET') {
        $user = current_user();
        $board = (string) ($_GET['board'] ?? 'collections');
        if (!in_array($board, RANKING_BOARDS, true)) {
            $board = 'collections';
        }
        $cursor = max(0, (int) ($_GET['cursor'] ?? 0));
        $limit = (int) ($_GET['limit'] ?? 20);
        if ($limit < 1 || $limit > 50) {
            $limit = 20;
        }
        $rows = ranking_rows($board);
        $total = count($rows);
        $slice = array_slice($rows, $cursor, $limit);
        $entries = [];
        foreach ($slice as $index => $row) {
            $entries[] = [
                'rank' => $cursor + $index + 1,
                'userId' => $row['userId'],
                'username' => $row['username'],
                'displayName' => $row['displayName'],
                'value' => (int) $row['value'],
                'isMe' => $row['userId'] === $user['id'],
            ];
        }
        $next = $cursor + count($slice);
        json_response([
            'success' => true,
            'data' => [
                'board' => $board,
                'entries' => $entries,
                'me' => ranking_position($rows, $user['id']),
                'total' => $total,
                'nextCursor' => $next < $total ? $next : null,
                'names' => currency_names(),
            ],
        ]);
    }
    if (preg_match('#^/api/transfers/([A-Za-z0-9_-]+)$#', $path, $matches) && $method === 'GET') {
        // 转让详情同时供用户端（dc_session）与后台抽屉（dc_admin_session）使用：
        // 先试管理会话，再回落用户会话，二者皆无才拒绝。
        $viewer = current_user(false, admin_cookie_name()) ?? current_user();
        json_response(['success' => true, 'data' => transfer_detail($matches[1], $viewer)]);
    }
    throw new ApiException('接口不存在', 404);
} catch (PDOException $error) {
    if (str_contains(strtolower($error->getMessage()), 'unique')) {
        json_response(['success' => false, 'message' => '数据已存在，请勿重复提交'], 409);
    }
    error_log($error->__toString());
    json_response(['success' => false, 'message' => '数据库操作失败'], 500);
} catch (ApiException $error) {
    json_response(['success' => false, 'message' => $error->getMessage()], $error->status);
} catch (Throwable $error) {
    error_log($error->__toString());
    json_response(['success' => false, 'message' => '服务暂时不可用，请稍后再试'], 500);
}
