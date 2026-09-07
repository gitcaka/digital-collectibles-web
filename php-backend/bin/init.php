<?php

declare(strict_types=1);

require dirname(__DIR__) . '/src/bootstrap.php';

/**
 * 增量迁移：为已存在的旧库补充新增列。表名与列名均来自本项目代码，非外部输入。
 */
function ensure_column(PDO $database, string $table, string $column, string $definition): void
{
    $statement = $database->prepare("PRAGMA table_info({$table})");
    $statement->execute();
    $columns = array_column($statement->fetchAll(), 'name');
    if (!in_array($column, $columns, true)) {
        $database->exec("ALTER TABLE {$table} ADD COLUMN {$definition}");
    }
}

$path = database_path();
$directory = dirname($path);
if (!is_dir($directory)) {
    mkdir($directory, 0775, true);
}

$database = new PDO('sqlite:' . $path, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$database->exec((string) file_get_contents(dirname(__DIR__) . '/database/schema.sql'));

ensure_column($database, 'collections', 'points_price', 'points_price INTEGER NOT NULL DEFAULT 0');
ensure_column($database, 'collections', 'redeem_mode', "redeem_mode TEXT NOT NULL DEFAULT 'both'");
ensure_column($database, 'redeem_codes', 'kind', "kind TEXT NOT NULL DEFAULT 'general'");

$users = [
    ['usr_shanhai', 'shanhai', 'demo1234', '山海客', 'user', 3600, 860, 2],
    ['usr_admin', 'admin', 'admin1234', '藏阁掌柜', 'admin', 99999, 9999, 7],
    ['usr_qinghe', 'qinghe', 'demo1234', '青禾', 'user', 2600, 420, 1],
    ['usr_yunsheng', 'yunsheng', 'demo1234', '云生', 'user', 5120, 1340, 5],
    ['usr_bailu', 'bailu', 'demo1234', '白露', 'user', 1880, 2260, 3],
    ['usr_xingye', 'xingye', 'demo1234', '星野', 'user', 7350, 980, 6],
    ['usr_yuejian', 'yuejian', 'demo1234', '月见', 'user', 920, 3120, 1],
    ['usr_shiguang', 'shiguang', 'demo1234', '拾光', 'user', 4400, 1750, 4],
    ['usr_mobai', 'mobai', 'demo1234', '墨白', 'user', 6100, 640, 2],
    ['usr_nanfeng', 'nanfeng', 'demo1234', '南风', 'user', 350, 4880, 7],
    ['usr_lingxi', 'lingxi', 'demo1234', '灵犀', 'user', 8800, 2100, 5],
    ['usr_ziye', 'ziye', 'demo1234', '子夜', 'user', 2040, 930, 0],
    ['usr_changfeng', 'changfeng', 'demo1234', '长风', 'user', 12600, 1520, 6],
    ['usr_qingzhao', 'qingzhao', 'demo1234', '清照', 'user', 4700, 3650, 3],
    ['usr_wuyin', 'wuyin', 'demo1234', '无音', 'user', 1580, 240, 1],
    ['usr_liuli', 'liuli', 'demo1234', '琉璃', 'user', 9900, 1180, 4],
    ['usr_baijia', 'baijia', 'demo1234', '百家', 'user', 720, 5460, 2],
    ['usr_muyun', 'muyun', 'demo1234', '暮云', 'user', 5650, 3080, 5],
    ['usr_chenxing', 'chenxing', 'demo1234', '辰星', 'user', 3150, 760, 0],
    ['usr_ansu', 'ansu', 'demo1234', '安素', 'user', 8250, 4400, 6],
    ['usr_yanhe', 'yanhe', 'demo1234', '烟河', 'user', 2380, 1650, 2],
    ['usr_jinwu', 'jinwu', 'demo1234', '金乌', 'user', 14200, 2900, 7],
];

$collections = [
    ['change', '月宫·嫦娥', '流光回转，月华常新', '以月宫嫦娥为主题的动态数字藏品，使用循环 GIF 呈现近似三维旋转效果。', '传说', 1280, 9800, 'both', 2000, 1326, 1],
    ['lingxiao', '凌霄剑', '破云而出的第一缕锋芒', '取凌霄云气与星铁之意，剑身收拢流光。', '史诗', 680, 5200, 'both', 3600, 2188, 1],
    ['jade-gourd', '青玉葫芦', '一器藏风月，青玉纳乾坤', '温润青玉器型，蕴藏山川灵气。', '稀有', 420, 3200, 'yuanbao', 5000, 3041, 1],
    ['star-lamp', '星河灯', '掌中一盏，映照万里星河', '轻盈灵巧的常驻藏品，可由兑换码或元宝获得。', '普通', 260, 1980, 'points', 8000, 4720, 0],
];

$database->beginTransaction();
try {
    $userInsert = $database->prepare(
        'INSERT OR IGNORE INTO users (id, username, password_hash, display_name, role, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    $walletInsert = $database->prepare('INSERT OR IGNORE INTO wallets (user_id, yuanbao) VALUES (?, ?)');
    $pointsInsert = $database->prepare('INSERT OR IGNORE INTO point_accounts (user_id, points, streak) VALUES (?, ?, ?)');
    foreach ($users as [$id, $username, $password, $displayName, $role, $yuanbao, $points, $streak]) {
        $userInsert->execute([$id, $username, password_hash($password, PASSWORD_DEFAULT), $displayName, $role, 'active']);
        $walletInsert->execute([$id, $yuanbao]);
        $pointsInsert->execute([$id, $points, $streak]);
    }

    $collectionInsert = $database->prepare(
        'INSERT OR IGNORE INTO collections
         (id, name, subtitle, description, rarity, price, points_price, redeem_mode, total, sold, transferable, image_url, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($collections as [$id, $name, $subtitle, $description, $rarity, $price, $pointsPrice, $redeemMode, $total, $sold, $transferable]) {
        $collectionInsert->execute([$id, $name, $subtitle, $description, $rarity, $price, $pointsPrice, $redeemMode, $total, $sold, $transferable, '/media/change.gif', 'on_sale']);
    }
    // 仅为空封面补充默认素材，避免覆盖运营上传的藏品图片。
    $database->exec("UPDATE collections SET image_url = '/media/change.gif' WHERE image_url IS NULL OR image_url = ''");

    // 旧库中已存在的藏品补默认积分价，但不覆盖运营后续调整过的价格。
    $pointsFallback = $database->prepare('UPDATE collections SET points_price = ? WHERE id = ? AND points_price = 0');
    foreach ($collections as [$id, , , , , , $pointsPrice]) {
        $pointsFallback->execute([$pointsPrice, $id]);
    }

    $ownedInsert = $database->prepare(
        'INSERT OR IGNORE INTO user_collections (id, user_id, collection_id, serial_no, source, status, acquired_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $ownedInsert->execute(['uc_change_0088', 'usr_shanhai', 'change', 88, '活动', 'normal', '2026-08-28 20:16:00']);
    $ownedInsert->execute(['uc_jade_0193', 'usr_shanhai', 'jade-gourd', 193, '兑换码', 'normal', '2026-08-16 09:42:00']);
    $ownedInsert->execute(['uc_star_0073', 'usr_qinghe', 'star-lamp', 73, '活动', 'transferring', '2026-08-20 12:00:00']);

    // 为每位普通用户铺一批持有记录，让排行榜/用户管理有足够测试数据。
    $collectionIds = array_column($collections, 0);
    $collectionCount = count($collectionIds);
    $serialCursor = 600;
    $userCursor = 0;
    foreach ($users as [$userId, , , , $role]) {
        if ($role !== 'user') {
            continue;
        }
        $userCursor++;
        $holdingCount = ($userCursor % 5) + 1;
        for ($slot = 0; $slot < $holdingCount; $slot++) {
            $serialCursor++;
            $day = (($userCursor * 3 + $slot) % 27) + 1;
            $ownedInsert->execute([
                sprintf('uc_seed_%02d_%d', $userCursor, $slot),
                $userId,
                $collectionIds[($userCursor + $slot) % $collectionCount],
                $serialCursor,
                '活动',
                'normal',
                sprintf('2026-08-%02d 10:%02d:00', $day, ($slot * 7) % 60),
            ]);
        }
    }

    $codeInsert = $database->prepare(
        'INSERT OR IGNORE INTO redeem_codes (id, code, title, kind, status, max_total, max_per_user, used_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $codeInsert->execute(['rc_vip2026', 'VIP-2026', '月华混合礼包', 'general', 'active', 500, 1, 0]);
    $codeInsert->execute(['rc_yuanbao88', 'YUANBAO88', '元宝补给', 'general', 'active', 1000, 1, 0]);
    $codeInsert->execute(['rc_meetqilin', 'MEET-QILIN', '初见星河礼包', 'general', 'active', 800, 1, 0]);
    $codeInsert->execute(['rc_once_vip', 'ONCE-8K2M7Q', '一次性尊享礼包', 'once', 'active', 1, 1, 0]);
    $codeInsert->execute(['rc_once_starter', 'ONCE-4H9XZP', '一次性新手礼', 'once', 'active', 1, 1, 0]);

    $rewardInsert = $database->prepare(
        'INSERT OR IGNORE INTO redeem_code_rewards (id, redeem_code_id, reward_type, amount, collection_id, label) VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ([
        ['rr_vip_yuanbao', 'rc_vip2026', 'yuanbao', 88, null, '元宝 × 88'],
        ['rr_vip_points', 'rc_vip2026', 'points', 120, null, '积分 × 120'],
        ['rr_vip_collection', 'rc_vip2026', 'collection', 1, 'lingxiao', '凌霄剑 × 1'],
        ['rr_yuanbao88', 'rc_yuanbao88', 'yuanbao', 888, null, '元宝 × 888'],
        ['rr_qilin_points', 'rc_meetqilin', 'points', 200, null, '积分 × 200'],
        ['rr_qilin_collection', 'rc_meetqilin', 'collection', 1, 'star-lamp', '星河灯 × 1'],
        ['rr_once_vip_yuanbao', 'rc_once_vip', 'yuanbao', 666, null, '元宝 × 666'],
        ['rr_once_vip_points', 'rc_once_vip', 'points', 500, null, '积分 × 500'],
        ['rr_once_vip_collection', 'rc_once_vip', 'collection', 1, 'lingxiao', '凌霄剑 × 1'],
        ['rr_once_starter_points', 'rc_once_starter', 'points', 300, null, '积分 × 300'],
    ] as $reward) {
        $rewardInsert->execute($reward);
    }

    $settingInsert = $database->prepare(
        'INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)'
    );
    $settingInsert->execute(['yuanbao_name', '元宝']);
    $settingInsert->execute(['points_name', '积分']);

    $bannerInsert = $database->prepare(
        'INSERT OR IGNORE INTO banners (id, title, image_url, link, sort_order, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ([
        ['bn_moon', '月宫幻境 · 嫦娥限定', '/media/banner-1.svg', '/collections/change?from=store', 1],
        ['bn_lingxiao', '凌霄剑影 · 史诗再临', '/media/banner-2.svg', '/collections/lingxiao?from=store', 2],
        ['bn_festival', '签到七日 · 积分翻倍', '/media/banner-3.svg', '/', 3],
    ] as [$id, $title, $imageUrl, $link, $sortOrder]) {
        $bannerInsert->execute([$id, $title, $imageUrl, $link, $sortOrder, 'active']);
    }

    $transferInsert = $database->prepare(
        'INSERT OR IGNORE INTO transfers
         (id, sender_user_id, recipient_username, recipient_user_id, user_collection_id, collection_id, price, fee, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $transferInsert->execute(['tr_incoming_001', 'usr_qinghe', 'shanhai', 'usr_shanhai', 'uc_star_0073', 'star-lamp', 260, 13, 'pending', '2026-09-02 18:30:00']);

    // —— 后台图表演示流水：近 30 天兑换/开户/转让成交量。
    //     以 app_settings.demo_trend_seeded 水位线保证「整段只跑一次」，重复执行 init 不会改写数据。
    $demoTrendSeeded = (string) $database->query("SELECT value FROM app_settings WHERE key = 'demo_trend_seeded'")->fetchColumn();
    if ($demoTrendSeeded === '') {
        $normalUsers = [];
        foreach ($users as [$userId, $username, , $displayName, $role]) {
            if ($role === 'user') {
                $normalUsers[] = ['id' => $userId, 'username' => $username, 'displayName' => $displayName];
            }
        }
        $normalCount = count($normalUsers);

        // 1) 种子用户开户时间摊到近 30 天，让「新增用户」趋势线有起伏。
        $createdOffsets = [26, 22, 24, 15, 18, 12, 20, 9, 16, 5, 11, 3, 14, 1, 7, 0, 2, 6, 4, 10, 8, 13];
        $spreadUser = $database->prepare('UPDATE users SET created_at = ? WHERE id = ?');
        foreach ($users as $index => [$userId]) {
            if (isset($createdOffsets[$index])) {
                $spreadUser->execute([
                    sprintf('%s %02d:%02d:00', shanghai_date(-$createdOffsets[$index]), 9 + ($index % 8), ($index * 11) % 60),
                    $userId,
                ]);
            }
        }

        // 2) 兑换记录：固定 id（rr_demo_<天数>_<序号>）铺出「近期更活跃」的兑换曲线。
        $demoRedeemCodes = [
            ['rc_vip2026', 'VIP-2026', '元宝 × 88、积分 × 120、凌霄剑 × 1'],
            ['rc_yuanbao88', 'YUANBAO88', '元宝 × 888'],
            ['rc_meetqilin', 'MEET-QILIN', '积分 × 200、星河灯 × 1'],
        ];
        $redeemDaily = [26 => 1, 24 => 1, 23 => 2, 22 => 1, 20 => 2, 19 => 1, 17 => 2, 16 => 1, 15 => 3, 14 => 1, 13 => 2, 12 => 2, 11 => 1, 10 => 3, 9 => 2, 8 => 2, 7 => 3, 6 => 2, 5 => 4, 4 => 3, 3 => 4, 2 => 5, 1 => 6, 0 => 4];
        $redeemInsert = $database->prepare(
            'INSERT OR IGNORE INTO redeem_records (id, user_id, redeem_code_id, code_snapshot, reward_summary, created_at) VALUES (?, ?, ?, ?, ?, ?)'
        );
        foreach ($redeemDaily as $offset => $count) {
            for ($sequence = 0; $sequence < $count; $sequence++) {
                [$codeId, $snapshot, $summary] = $demoRedeemCodes[($offset + $sequence) % count($demoRedeemCodes)];
                $redeemUser = $normalUsers[($offset + $sequence * 3) % $normalCount];
                $redeemInsert->execute([
                    sprintf('rr_demo_%02d_%d', $offset, $sequence),
                    $redeemUser['id'],
                    $codeId,
                    $snapshot,
                    $summary,
                    sprintf('%s %02d:%02d:00', shanghai_date(-$offset), 9 + (($offset + $sequence * 5) % 9), ($offset * 7 + $sequence * 17) % 60),
                ]);
            }
        }

        // 3) 已完成转让（演示历史订单，免费赠送）：引用 uc_seed_04_* 之后的持有记录，避开常用测试资产。
        $transferOffsets = [23, 20, 18, 15, 12, 9, 7, 4, 2, 1];
        $transferInsert = $database->prepare(
            "INSERT OR IGNORE INTO transfers
             (id, sender_user_id, recipient_username, recipient_user_id, user_collection_id, collection_id, price, fee, status, completed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'completed', ?, ?)"
        );
        foreach ($transferOffsets as $rowIndex => $offset) {
            $cursor = 4 + (($rowIndex * 5) % 18); // 4..21：跳过 uc_seed_01~03（shanhai/qinghe/yunsheng 常用资产）
            $holder = $normalUsers[$cursor - 1];
            $slot = $rowIndex % ((($cursor % 5) + 1));
            $recipient = $normalUsers[($cursor + 3) % $normalCount];
            $transferInsert->execute([
                sprintf('tr_demo_%02d', $offset),
                $holder['id'],
                $recipient['username'],
                $recipient['id'],
                sprintf('uc_seed_%02d_%d', $cursor, $slot),
                $collectionIds[($cursor + $slot) % $collectionCount],
                sprintf('%s %02d:%02d:00', shanghai_date(-$offset), 14 + ($rowIndex % 6), ($rowIndex * 23) % 60),
                sprintf('%s %02d:%02d:00', shanghai_date(-$offset), 18 + ($rowIndex % 4), ($rowIndex * 31) % 60),
            ]);
        }

        $database->exec("INSERT OR IGNORE INTO app_settings (key, value) VALUES ('demo_trend_seeded', '1')");
    }

    $database->commit();
    echo "PHP SQLite database ready: {$path}" . PHP_EOL;
} catch (Throwable $error) {
    $database->rollBack();
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}

