/* Barcode numbers: the check digit, UPC-E, and a guard against a camera misread. */

/** True when the last digit is the GTIN check digit (EAN-8, UPC-A, EAN-13, GTIN-14). */
export function validGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
  let sum = 0;
  for (let i = code.length - 2, w = 3; i >= 0; i--, w = 4 - w) sum += Number(code[i]) * w;
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}

/** The short UPC-E code written out as the 12-digit UPC-A it stands for; null when it is not UPC-E. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const s = code[0], d = code.slice(1, 7), x = code[7], last = d[5]!;
  const body = last <= '2' ? `${d.slice(0, 2)}${last}0000${d.slice(2, 5)}`
    : last === '3' ? `${d.slice(0, 3)}00000${d.slice(3, 5)}`
    : last === '4' ? `${d.slice(0, 4)}00000${d[4]}`
    : `${d.slice(0, 5)}0000${last}`;
  return `${s}${body}${x}`;
}

/** The number to look up, or null when the digits cannot be a product code. */
export function cleanCode(raw: string): string | null {
  const code = raw.replace(/\D/g, '');
  if (validGtin(code)) return code;
  const wide = expandUpcE(code);
  return wide && validGtin(wide) ? wide : null;
}

/** The same product whatever zeros the scanner or the database put in front. */
export const sameCode = (a: string, b: string) => a.replace(/^0+/, '') === b.replace(/^0+/, '');

/** A code counts once the camera has read it `need` times in a row: one blurred frame can pass the check digit by luck. */
export class Confirm {
  private last = '';
  private n = 0;
  private need: number;
  constructor(need = 2) { this.need = need; }
  feed(raw: string): string | null {
    const code = cleanCode(raw);
    if (!code) return null;
    this.n = code === this.last ? this.n + 1 : 1;
    this.last = code;
    return this.n >= this.need ? code : null;
  }
}
