import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/** Compared against when the email is unknown, so response time doesn't reveal which emails exist. */
export const DUMMY_HASH = "$2b$12$GNMrHoKeK2LNEa.gtMgSDOro/8YpSF.ZdEXbGrUIb/RF3mSVayrhe";

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
