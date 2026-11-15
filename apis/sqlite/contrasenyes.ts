/**
 * Contrasenyes: es desen amb scrypt i una sal per usuari, mai en clar.
 * Format: `scrypt$<sal en base64>$<resum en base64>`.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const LLARGADA = 64;

export function xifraContrasenya(contrasenya: string) {
  const sal = randomBytes(16);
  const resum = scryptSync(contrasenya, sal, LLARGADA);
  return `scrypt$${sal.toString("base64")}$${resum.toString("base64")}`;
}

export function contrasenyaCorrecta(contrasenya: string, desada: string | null | undefined) {
  if (!desada) return false;
  const [algorisme, sal, resum] = desada.split("$");
  if (algorisme !== "scrypt" || !sal || !resum) return false;
  const esperat = Buffer.from(resum, "base64");
  const calculat = scryptSync(contrasenya, Buffer.from(sal, "base64"), esperat.length);
  return esperat.length === calculat.length && timingSafeEqual(esperat, calculat);
}
