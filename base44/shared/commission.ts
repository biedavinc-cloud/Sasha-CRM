export function calculateCommissionAmount(opts: {
  basis: string;
  grossAmount: number;
  eligibleAmount: number;
  rate: number;
  minTransaction?: number;
  maxCommission?: number;
}): { eligible: boolean; amount: number; base: number } {
  const { basis, grossAmount, eligibleAmount, rate, minTransaction = 0, maxCommission } = opts;
  const gross = Number(grossAmount) || 0;
  if (gross < (minTransaction || 0)) {
    return { eligible: false, amount: 0, base: 0 };
  }
  const base = basis === "profit" ? (Number(eligibleAmount) || 0) : gross;
  let amount = base * ((Number(rate) || 0) / 100);
  if (maxCommission && amount > maxCommission) amount = maxCommission;
  return { eligible: true, amount: Math.round(amount * 100) / 100, base: Math.round(base * 100) / 100 };
}