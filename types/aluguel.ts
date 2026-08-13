export type RentPlan = {
  id: string;
  title: string;
  payee_id: string;
  due_day: number;
  pix_key: string | null;
  notes: string | null;
  active: boolean;
  created_by: string;
};

/** Linha da view v_rent_status: parcela com quanto ja foi pago e quanto falta. */
export type RentStatus = {
  id: string;
  plan_id: string;
  user_id: string;
  reference_month: string;
  due_date: string;
  amount: number;
  pago: number;
  restante: number;
  paid: boolean;
  paid_at: string | null;
};

export type RentPayment = {
  id: string;
  installment_id: string;
  amount: number;
  paid_at: string;
  method: string | null;
  note: string | null;
  registered_by: string;
};
