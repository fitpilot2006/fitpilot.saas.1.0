import jwt from "jsonwebtoken";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";

export interface GymTokenPayload {
  userId: number;
  gymId: number;
  email: string;
  role: string;
}

export interface PlatformAdminTokenPayload {
  adminId: number;
  email: string;
  role: "platform_admin";
  gymId: 0;
}

export function signGymToken(payload: GymTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function signPlatformAdminToken(payload: PlatformAdminTokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): GymTokenPayload | PlatformAdminTokenPayload {
  return jwt.verify(token, SECRET) as GymTokenPayload | PlatformAdminTokenPayload;
}
