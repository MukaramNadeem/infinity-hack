import bcrypt from 'bcryptjs';

const ROUNDS = 10;

export const hashPassword = (plain: string) => bcrypt.hash(plain, ROUNDS);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Compared against when the email is unknown, so login takes the same time either way
// (prevents discovering which emails exist via response timing).
export const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', ROUNDS);
