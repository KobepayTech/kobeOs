import { BadRequestException } from '@nestjs/common';

/** Exact decimal quantization to the ledger's four fractional places.
 * Reject values the existing numeric API cannot safely represent. */
export function ledgerUnits(value: number): bigint {
  if (!Number.isFinite(value)) throw new BadRequestException('Ledger amount must be finite');
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match) throw new BadRequestException('Invalid ledger amount');
  const digits = BigInt(match[2] + (match[3] || ''));
  const power = Number(match[4] || 0) - (match[3] || '').length + 4;
  let units: bigint;
  if (power >= 0) units = digits * 10n ** BigInt(power);
  else {
    const divisor = 10n ** BigInt(-power);
    units = (digits + divisor / 2n) / divisor;
  }
  if (units > BigInt(Number.MAX_SAFE_INTEGER)) throw new BadRequestException('Ledger amount exceeds the safe numeric range');
  return match[1] ? -units : units;
}

export function ledgerNumber(units: bigint): number {
  if (units > BigInt(Number.MAX_SAFE_INTEGER) || units < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new BadRequestException('Ledger balance exceeds the safe numeric range');
  }
  return Number(units) / 10000;
}
