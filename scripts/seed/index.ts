// pnpm seed — 테스트 회원과 지난 30일 로그인 이벤트를 만든다.
// 여러 번 실행해도 안전하다: 회원은 있으면 건너뛰고, 시드 이벤트는 지우고 다시 넣는다.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { buildEvents, buildSql } from './events.ts';
import { createAdminClient, waitForKeycloak } from './keycloak.ts';
import { createRandom } from './random.ts';
import { buildSeedUsers, ensureUsers } from './users.ts';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function runSql(sqlText: string): boolean {
  const res = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'keycloak',
      '-d',
      'keycloak',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { cwd: ROOT, input: sqlText, encoding: 'utf8' },
  );
  if (res.status !== 0) {
    console.warn(`  ⚠️ SQL 실행 실패: ${res.stderr || res.error?.message || '알 수 없는 오류'}`);
    return false;
  }
  return true;
}

async function main() {
  const random = createRandom(20261123);

  console.log('1/3 Keycloak 연결 확인');
  await waitForKeycloak();
  const admin = await createAdminClient();

  console.log('2/3 테스트 회원 만들기');
  const users = await ensureUsers(admin, buildSeedUsers(random));

  console.log('3/3 지난 30일 이벤트 넣기 (DB 직접)');
  const now = Date.now();
  const events = buildEvents(random, users, now);
  const ok = runSql(buildSql(events, users, now));
  if (ok) {
    // Keycloak 은 회원 정보를 메모리에 캐시한다. DB 에서 바꾼 가입일이 보이도록 캐시를 비운다.
    await admin.post('/clear-user-cache', {});
    const count = (type: string) => events.filter((e) => e.type === type).length;
    console.log(
      `  이벤트 ${events.length}건: 로그인 ${count('LOGIN')} · 실패 ${count('LOGIN_ERROR')} · 로그아웃 ${count('LOGOUT')} · 가입 ${count('REGISTER')}`,
    );
  } else {
    console.warn('  이벤트 시드를 건너뜁니다. 대시보드에는 실제로 발생한 이벤트만 보입니다.');
  }

  console.log('\n완료. 테스트 계정 (로컬 전용):');
  console.table([
    { 계정: 'admin@moveid.local', 비밀번호: 'Admin123!', 역할: 'moveid-admin' },
    { 계정: 'viewer@moveid.local', 비밀번호: 'Viewer123!', 역할: 'moveid-viewer' },
    { 계정: 'user@moveid.local', 비밀번호: 'User1234!', 역할: '일반' },
    { 계정: 'disabled@moveid.local', 비밀번호: 'User1234!', 역할: '일반 (정지)' },
    { 계정: 'user01~40@moveid.local', 비밀번호: 'User1234!', 역할: '일반' },
  ]);
}

main().catch((err: unknown) => {
  console.error('\n시드 실패:', err instanceof Error ? err.message : err);
  process.exit(1);
});
