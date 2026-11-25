// 대시보드·감사 로그용 과거 이벤트를 SQL 로 만든다.
// Keycloak 이벤트 API 에는 "쓰기"가 없어서, 과거 날짜 이벤트는 DB 에 직접 넣을 수밖에 없다.
// ⚠️ Keycloak 26.8 의 event_entity 테이블 구조를 전제로 한다 (버전을 바꾸면 다시 확인).

import { randomUUID } from 'node:crypto';

import type { Random } from './random.ts';
import type { CreatedUser } from './users.ts';

/** 시드로 넣은 행은 id 가 이 값으로 시작한다 → 다시 실행할 때 이것만 지운다. */
const SEED_ID_PREFIX = '5eed';

const DAY = 24 * 60 * 60 * 1000;

const CLIENTS = [
  ['moveid-ride', 55],
  ['moveid-charge', 30],
  ['moveid-account', 15],
] as const;

const CLIENT_PORT: Record<string, number> = {
  'moveid-account': 5173,
  'moveid-admin': 5174,
  'moveid-ride': 5175,
  'moveid-charge': 5176,
};

interface EventRow {
  type: 'LOGIN' | 'LOGIN_ERROR' | 'LOGOUT' | 'REGISTER';
  time: number;
  clientId: string;
  userId: string | null;
  sessionId: string | null;
  ip: string;
  error: string | null;
  details: Record<string, string>;
}

const sql = (v: string | number | null) =>
  v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replaceAll("'", "''")}'`;

function randomIp(random: Random) {
  return random.chance(0.7)
    ? `211.${random.int(32, 63)}.${random.int(0, 255)}.${random.int(1, 254)}`
    : `10.0.${random.int(0, 20)}.${random.int(1, 254)}`;
}

/** 하루 중 사람들이 많이 접속하는 시간대(출퇴근)에 더 몰리게 */
function randomTimeOfDay(random: Random) {
  const hour = random.weighted([
    [7, 6],
    [8, 10],
    [9, 8],
    [10, 5],
    [11, 5],
    [12, 6],
    [13, 5],
    [14, 4],
    [15, 4],
    [16, 4],
    [17, 6],
    [18, 10],
    [19, 8],
    [20, 6],
    [21, 5],
    [22, 3],
    [23, 2],
    [0, 1],
  ] as const);
  return (hour * 60 + random.int(0, 59)) * 60_000 + random.int(0, 59_999);
}

export function buildEvents(random: Random, users: CreatedUser[], now = Date.now()): EventRow[] {
  const active = users.filter((u) => u.enabled);
  const disabled = users.filter((u) => !u.enabled);
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const rows: EventRow[] = [];

  // 가입 이벤트: 각 회원의 가입 시점
  for (const u of users) {
    const time = startOfToday - u.joinedDaysAgo * DAY + randomTimeOfDay(random);
    if (time > now) continue;
    rows.push({
      type: 'REGISTER',
      time,
      clientId: 'moveid-ride',
      userId: u.id,
      sessionId: null,
      ip: randomIp(random),
      error: null,
      details: { auth_method: 'openid-connect', register_method: 'form', username: u.email },
    });
  }

  // 지난 30일(오늘 포함) 로그인 · 실패 · 로그아웃
  for (let daysAgo = 29; daysAgo >= 0; daysAgo--) {
    const dayStart = startOfToday - daysAgo * DAY;
    const weekday = new Date(dayStart).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const logins = isWeekend ? random.int(25, 45) : random.int(45, 80);

    for (let i = 0; i < logins; i++) {
      const time = dayStart + randomTimeOfDay(random);
      if (time > now) continue;
      const clientId = random.weighted(CLIENTS);
      const redirect = `http://localhost:${CLIENT_PORT[clientId]}/callback`;
      const ip = randomIp(random);

      // 약 10%는 실패: 비밀번호 오류 / 없는 계정 / 정지된 계정
      if (random.chance(0.1)) {
        const kind = random.weighted([
          ['invalid_user_credentials', 70],
          ['user_not_found', 20],
          ['user_disabled', 10],
        ] as const);
        const target =
          kind === 'user_disabled' && disabled.length > 0
            ? random.pick(disabled)
            : kind === 'user_not_found'
              ? null
              : random.pick(active);
        rows.push({
          type: 'LOGIN_ERROR',
          time,
          clientId,
          userId: target?.id ?? null,
          sessionId: null,
          ip,
          error: kind,
          details: {
            auth_method: 'openid-connect',
            auth_type: 'code',
            redirect_uri: redirect,
            username: target?.email ?? `unknown${random.int(1, 999)}@example.com`,
          },
        });
        continue;
      }

      const user = random.pick(active);
      const sessionId = randomUUID();
      rows.push({
        type: 'LOGIN',
        time,
        clientId,
        userId: user.id,
        sessionId,
        ip,
        error: null,
        details: {
          auth_method: 'openid-connect',
          auth_type: 'code',
          redirect_uri: redirect,
          code_id: sessionId,
          username: user.email,
        },
      });

      // 일부는 같은 날 로그아웃
      if (random.chance(0.35)) {
        const logoutTime = time + random.int(5, 240) * 60_000;
        if (logoutTime <= now) {
          rows.push({
            type: 'LOGOUT',
            time: logoutTime,
            clientId,
            userId: user.id,
            sessionId,
            ip,
            error: null,
            details: { redirect_uri: `http://localhost:${CLIENT_PORT[clientId]}/` },
          });
        }
      }
    }
  }

  return rows.sort((a, b) => a.time - b.time);
}

/** 이벤트 + 가입일 보정 SQL. 한 트랜잭션으로 실행한다. */
export function buildSql(rows: EventRow[], users: CreatedUser[], now = Date.now()): string {
  const realm = `(SELECT id FROM realm WHERE name = 'moveid')`;
  const lines: string[] = [
    'BEGIN;',
    `DELETE FROM event_entity WHERE id LIKE '${SEED_ID_PREFIX}%';`,
  ];

  // 가입일(created_timestamp) 을 REGISTER 이벤트 시각과 맞춘다
  const registerTime = new Map(
    rows.filter((r) => r.type === 'REGISTER').map((r) => [r.userId, r.time]),
  );
  for (const u of users) {
    const t = registerTime.get(u.id) ?? now - u.joinedDaysAgo * DAY;
    lines.push(`UPDATE user_entity SET created_timestamp = ${t} WHERE id = ${sql(u.id)};`);
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const values = rows.slice(i, i + BATCH).map((r, j) => {
      const id = `${SEED_ID_PREFIX}0000-0000-4000-8000-${(i + j).toString(16).padStart(12, '0')}`;
      return `(${[
        sql(id),
        sql(r.clientId),
        sql(r.error),
        sql(r.ip),
        realm,
        sql(r.sessionId),
        sql(r.time),
        sql(r.type),
        sql(r.userId),
        sql(JSON.stringify(r.details)),
      ].join(', ')})`;
    });
    lines.push(
      `INSERT INTO event_entity (id, client_id, error, ip_address, realm_id, session_id, event_time, type, user_id, details_json_long_value) VALUES\n${values.join(',\n')};`,
    );
  }

  lines.push('COMMIT;');
  return lines.join('\n');
}
