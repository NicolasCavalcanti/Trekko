import bcrypt from 'bcryptjs'

const parsedSaltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10)
const SALT_ROUNDS = Number.isFinite(parsedSaltRounds) ? parsedSaltRounds : 12

export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText) {
    throw new Error('PASSWORD_REQUIRED')
  }
  return bcrypt.hash(plainText, SALT_ROUNDS)
}

export async function verifyPassword(plainText: string, passwordHash: string): Promise<boolean> {
  if (!plainText || !passwordHash) {
    return false
  }
  try {
    return await bcrypt.compare(plainText, passwordHash)
  } catch (error) {
    return false
  }
}
