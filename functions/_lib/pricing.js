// The ONE place prices live on the server. (public/order/index.html shows the same numbers for display only.)
export const UNIT_CENTS = 2900;                         // $29 early-adopter price
export const CUSTOM_COLOR_FEE_CENTS = 500;                // extra per sign for a custom color (set when you decide)
export const TIERS = [[25, 20], [10, 15], [5, 10]];     // [min qty, % off]
export const SHIPPING_CENTS = 500;                      // flat rate under FREE_SHIP_QTY signs
export const FREE_SHIP_QTY = 5;
export const MAX_QTY = 100;

export function quote(qty, kind) {
  qty = Math.floor(+qty);
  if (!(qty >= 1 && qty <= MAX_QTY)) return null;
  const off = (TIERS.find(([n]) => qty >= n) || [0, 0])[1];
  const base = UNIT_CENTS + (kind === 'custom' ? CUSTOM_COLOR_FEE_CENTS : 0);
  const unit = Math.round(base * (100 - off) / 100);
  return { qty, unit, off, subtotal: unit * qty, shipping: qty >= FREE_SHIP_QTY ? 0 : SHIPPING_CENTS };
}
