import type { AdminClient } from './keycloak.ts';
import type { Random } from './random.ts';

export interface SeedUser {
  email: string;
  password: string;
  name: string;
  birthdate: string;
  marketing: boolean;
  enabled: boolean;
  role?: 'moveid-admin' | 'moveid-viewer';
  /** 며칠 전에 가입한 것으로 만들지 (가입일을 흩뿌려 회원 목록을 그럴듯하게) */
  joinedDaysAgo: number;
}

export interface CreatedUser extends SeedUser {
  id: string;
}

const SURNAMES = [
  '김',
  '이',
  '박',
  '최',
  '정',
  '강',
  '조',
  '윤',
  '장',
  '임',
  '한',
  '오',
  '서',
  '신',
];
const GIVEN = [
  '민준',
  '서연',
  '도윤',
  '하은',
  '시우',
  '지유',
  '주원',
  '서윤',
  '하준',
  '지민',
  '예준',
  '수아',
  '건우',
  '채원',
  '우진',
  '다은',
  '선우',
  '예린',
  '현우',
  '유나',
];

/** 테스트 계정 목록. 비밀번호는 로컬 전용이다. */
export function buildSeedUsers(random: Random): SeedUser[] {
  const fixed: SeedUser[] = [
    {
      email: 'admin@moveid.local',
      password: 'Admin123!',
      name: '관리자',
      birthdate: '1990-01-15',
      marketing: false,
      enabled: true,
      role: 'moveid-admin',
      joinedDaysAgo: 85,
    },
    {
      email: 'viewer@moveid.local',
      password: 'Viewer123!',
      name: '조회관리자',
      birthdate: '1992-06-30',
      marketing: false,
      enabled: true,
      role: 'moveid-viewer',
      joinedDaysAgo: 84,
    },
    {
      email: 'user@moveid.local',
      password: 'User1234!',
      name: '박무브',
      birthdate: '1998-03-14',
      marketing: true,
      enabled: true,
      joinedDaysAgo: 60,
    },
    {
      email: 'disabled@moveid.local',
      password: 'User1234!',
      name: '정지회원',
      birthdate: '1995-11-02',
      marketing: false,
      enabled: false,
      joinedDaysAgo: 45,
    },
  ];

  const generated: SeedUser[] = Array.from({ length: 40 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    const year = random.int(1965, 2008);
    const month = String(random.int(1, 12)).padStart(2, '0');
    const day = String(random.int(1, 28)).padStart(2, '0');
    return {
      email: `user${n}@moveid.local`,
      password: 'User1234!',
      name: random.pick(SURNAMES) + random.pick(GIVEN),
      birthdate: `${year}-${month}-${day}`,
      marketing: random.chance(0.4),
      enabled: true,
      joinedDaysAgo: random.int(0, 80),
    };
  });

  return [...fixed, ...generated];
}

/** 회원을 만든다. 이미 있으면 건너뛰고 기존 id 를 돌려준다 (여러 번 실행해도 안전). */
export async function ensureUsers(admin: AdminClient, users: SeedUser[]): Promise<CreatedUser[]> {
  const roles = {
    'moveid-admin': await admin.get<{ id: string; name: string }>('/roles/moveid-admin'),
    'moveid-viewer': await admin.get<{ id: string; name: string }>('/roles/moveid-viewer'),
  };

  const result: CreatedUser[] = [];
  let created = 0;

  for (const user of users) {
    const res = await admin.post('/users', {
      username: user.email,
      email: user.email,
      emailVerified: true,
      firstName: user.name,
      enabled: user.enabled,
      attributes: {
        birthdate: [user.birthdate],
        terms_service: ['true'],
        terms_privacy: ['true'],
        ...(user.marketing ? { marketing_opt_in: ['true'] } : {}),
      },
      credentials: [{ type: 'password', value: user.password, temporary: false }],
    });
    const isNew = res.status === 201;

    const [found] = await admin.get<{ id: string }[]>(
      `/users?email=${encodeURIComponent(user.email)}&exact=true&briefRepresentation=true`,
    );
    if (!found) throw new Error(`${user.email} 을(를) 찾을 수 없습니다.`);

    if (isNew) {
      created++;
      if (user.role) {
        await admin.post(`/users/${found.id}/role-mappings/realm`, [roles[user.role]]);
      }
    }
    result.push({ ...user, id: found.id });
  }

  console.log(`  회원 ${users.length}명 중 새로 만든 회원 ${created}명 (나머지는 이미 있음)`);
  return result;
}
