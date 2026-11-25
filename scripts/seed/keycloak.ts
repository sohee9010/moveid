// Keycloak Admin REST API 를 호출하는 작은 클라이언트 (시드 전용).
// master realm 의 부트스트랩 관리자(.env 의 KC_BOOTSTRAP_ADMIN_*)로 토큰을 받는다.

export const KEYCLOAK_URL = process.env.KEYCLOAK_URL ?? 'http://localhost:8080';
export const REALM = 'moveid';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`.env 에 ${name} 이(가) 없습니다.`);
  return value;
}

/** Keycloak 이 응답할 때까지 기다린다 (최대 timeoutMs). */
export async function waitForKeycloak(timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${KEYCLOAK_URL}/realms/${REALM}`);
      if (res.ok) return;
    } catch {
      // 아직 기동 중
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    `Keycloak(${KEYCLOAK_URL})이 응답하지 않습니다. 'pnpm kc:up' 을 먼저 실행하세요.`,
  );
}

export interface AdminClient {
  get<T>(path: string): Promise<T>;
  post(path: string, body: unknown): Promise<Response>;
  put(path: string, body: unknown): Promise<Response>;
}

export async function createAdminClient(): Promise<AdminClient> {
  const tokenRes = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      client_id: 'admin-cli',
      grant_type: 'password',
      username: requireEnv('KC_BOOTSTRAP_ADMIN_USERNAME'),
      password: requireEnv('KC_BOOTSTRAP_ADMIN_PASSWORD'),
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(
      `관리자 토큰 발급 실패 (${tokenRes.status}). .env 의 KC_BOOTSTRAP_ADMIN_* 를 확인하세요.`,
    );
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const base = `${KEYCLOAK_URL}/admin/realms/${REALM}`;
  const headers = { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json' };

  const send = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
    });
    if (!res.ok && res.status !== 409) {
      throw new Error(`${method} ${path} → ${res.status} ${await res.text()}`);
    }
    return res;
  };

  return {
    get: async <T>(path: string) => (await (await send('GET', path)).json()) as T,
    post: (path, body) => send('POST', path, body),
    put: (path, body) => send('PUT', path, body),
  };
}
