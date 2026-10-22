export type SessionRole = 'user' | 'business' | 'admin';

export type SessionContext = {
  userId: string;
  role: SessionRole;
};

export type SessionReader = {
  getSession(token: string | undefined): Promise<{ userId: string; role?: SessionRole } | null>;
};

export async function resolveSessionContext(
  token: string | undefined,
  reader: SessionReader,
): Promise<SessionContext | null> {
  if (!token) return null;

  const session = await reader.getSession(token);
  if (!session?.role) return null;

  return { userId: session.userId, role: session.role };
}
