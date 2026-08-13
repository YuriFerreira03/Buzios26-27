/**
 * Matematica de divisao de despesas.
 *
 * Tudo aqui trabalha em CENTAVOS (inteiros). Dinheiro em ponto flutuante
 * acumula erro: 0.1 + 0.2 !== 0.3. Com inteiros, a soma das partes bate
 * exatamente com o total, sempre.
 */

export type Transferencia = { from: string; to: string; amount: number };

export const paraCentavos = (v: number | string) => Math.round(Number(v || 0) * 100);
export const paraReais = (c: number) => c / 100;

/**
 * Distribui `total` centavos entre os pesos informados, usando o metodo do
 * maior resto: cada um recebe a parte inteira e os centavos que sobram vao
 * para quem tem a maior fracao truncada.
 *
 * distribuir(1000, [1, 1, 1]) -> [334, 333, 333]
 */
export function distribuir(total: number, pesos: number[]): number[] {
  const soma = pesos.reduce((a, b) => a + b, 0);
  if (soma <= 0) return pesos.map(() => 0);

  const exatos = pesos.map((p) => (total * p) / soma);
  const base = exatos.map(Math.floor);
  const resto = total - base.reduce((a, b) => a + b, 0);

  const ordem = exatos
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < resto; k++) base[ordem[k % ordem.length].i] += 1;

  return base;
}

/** Divisao igual entre os participantes. */
export function dividirIgual(totalCentavos: number, participantes: string[]) {
  const partes = distribuir(totalCentavos, participantes.map(() => 1));
  return participantes.map((id, i) => ({ user_id: id, share: partes[i] }));
}

export type DespesaCalc = {
  id: string;
  amount: number; // centavos
  paid_by: string;
};

export type DivisaoCalc = {
  expense_id: string;
  user_id: string;
  share: number; // centavos
};

export type AcertoCalc = {
  from_user: string;
  to_user: string;
  amount: number; // centavos
};

/**
 * Saldo liquido de cada pessoa, em centavos.
 *  > 0  o grupo deve para ela
 *  < 0  ela deve para o grupo
 */
export function calcularSaldos(
  membros: string[],
  despesas: DespesaCalc[],
  divisoes: DivisaoCalc[],
  acertos: AcertoCalc[],
): Record<string, number> {
  const saldo: Record<string, number> = {};
  membros.forEach((id) => (saldo[id] = 0));

  despesas.forEach((d) => {
    if (saldo[d.paid_by] === undefined) saldo[d.paid_by] = 0;
    saldo[d.paid_by] += d.amount;
  });

  divisoes.forEach((s) => {
    if (saldo[s.user_id] === undefined) saldo[s.user_id] = 0;
    saldo[s.user_id] -= s.share;
  });

  acertos.forEach((a) => {
    if (saldo[a.from_user] === undefined) saldo[a.from_user] = 0;
    if (saldo[a.to_user] === undefined) saldo[a.to_user] = 0;
    saldo[a.from_user] += a.amount;
    saldo[a.to_user] -= a.amount;
  });

  return saldo;
}

/**
 * Dividas reais entre pares, ja compensadas nos dois sentidos.
 * Se A deve 50 a B e B deve 20 a A, retorna apenas A -> B de 30.
 */
export function dividasPorPar(
  despesas: DespesaCalc[],
  divisoes: DivisaoCalc[],
  acertos: AcertoCalc[],
): Transferencia[] {
  const pagador = new Map(despesas.map((d) => [d.id, d.paid_by]));
  const bruto = new Map<string, number>(); // "devedor|credor" -> centavos

  const somar = (devedor: string, credor: string, valor: number) => {
    if (devedor === credor || valor === 0) return;
    const chave = `${devedor}|${credor}`;
    bruto.set(chave, (bruto.get(chave) ?? 0) + valor);
  };

  divisoes.forEach((s) => {
    const credor = pagador.get(s.expense_id);
    if (credor) somar(s.user_id, credor, s.share);
  });

  // Um acerto de A para B reduz a divida de A com B.
  acertos.forEach((a) => somar(a.to_user, a.from_user, a.amount));

  const liquido: Transferencia[] = [];
  const vistos = new Set<string>();

  bruto.forEach((valor, chave) => {
    const [a, b] = chave.split("|");
    const par = [a, b].sort().join("|");
    if (vistos.has(par)) return;
    vistos.add(par);

    const ida = bruto.get(`${a}|${b}`) ?? 0;
    const volta = bruto.get(`${b}|${a}`) ?? 0;
    const net = ida - volta;

    if (net > 0) liquido.push({ from: a, to: b, amount: net });
    else if (net < 0) liquido.push({ from: b, to: a, amount: -net });
  });

  return liquido.sort((x, y) => y.amount - x.amount);
}

/**
 * Reduz a rede de dividas ao menor numero de transferencias possivel,
 * pelo metodo guloso: o maior devedor paga o maior credor.
 * Os saldos finais sao identicos; muda so quantos Pix precisam sair.
 */
export function simplificarDividas(saldos: Record<string, number>): Transferencia[] {
  const credores = Object.entries(saldos)
    .filter(([, v]) => v > 0)
    .map(([id, v]) => ({ id, v }))
    .sort((a, b) => b.v - a.v);

  const devedores = Object.entries(saldos)
    .filter(([, v]) => v < 0)
    .map(([id, v]) => ({ id, v: -v }))
    .sort((a, b) => b.v - a.v);

  const out: Transferencia[] = [];
  let i = 0;
  let j = 0;

  while (i < devedores.length && j < credores.length) {
    const valor = Math.min(devedores[i].v, credores[j].v);
    if (valor > 0) out.push({ from: devedores[i].id, to: credores[j].id, amount: valor });

    devedores[i].v -= valor;
    credores[j].v -= valor;

    if (devedores[i].v === 0) i++;
    if (credores[j].v === 0) j++;
  }

  return out;
}
