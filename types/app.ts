/** Tipos compartilhados da aplicacao. Espelham o schema.sql. */

export type Member = {
  id: string;
  full_name: string;
  nickname: string | null;
};

export type RentInstallment = {
  id: string;
  user_id: string;
  reference_month: string;
  due_date: string;
  amount: number;
  paid: boolean;
  paid_at: string | null;
  confirmed_by: string | null;
};

export type FundType = "entrada" | "saida";

export type FundCategory =
  | "aluguel"
  | "mercado"
  | "bebida"
  | "transporte"
  | "passeio"
  | "utilidades"
  | "extra"
  | "outros";

export type FundTransaction = {
  id: string;
  type: FundType;
  amount: number;
  description: string;
  category: FundCategory;
  member_id: string;
  created_by: string;
  occurred_at: string;
};

export type Balance = {
  total_in: number;
  total_out: number;
  balance: number;
};

export const CATEGORIAS: { value: FundCategory; label: string }[] = [
  { value: "mercado", label: "Mercado" },
  { value: "bebida", label: "Bebida" },
  { value: "transporte", label: "Transporte" },
  { value: "passeio", label: "Passeio" },
  { value: "utilidades", label: "Utilidades" },
  { value: "aluguel", label: "Aluguel" },
  { value: "extra", label: "Extra" },
  { value: "outros", label: "Outros" },
];
