import type { FundCategory } from "@/types/app";

export type SplitMethod = "igual" | "exato" | "porcentagem" | "cotas";

export type Expense = {
  id: string;
  description: string;
  amount: number;
  category: FundCategory;
  paid_by: string;
  split_method: SplitMethod;
  occurred_at: string;
  notes: string | null;
  created_by: string;
};

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  share: number;
};

export type Settlement = {
  id: string;
  from_user: string;
  to_user: string;
  amount: number;
  occurred_at: string;
  note: string | null;
  created_by: string;
};
