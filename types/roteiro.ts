export type ScheduleCategory =
  | "praia"
  | "festa"
  | "refeicao"
  | "logistica"
  | "passeio"
  | "outros";

export type ScheduleItem = {
  id: string;
  day: string;
  starts_at: string | null;
  ends_at: string | null;
  title: string;
  description: string | null;
  location: string | null;
  category: ScheduleCategory;
  position: number;
  created_by: string;
};

export type Attendance = {
  id: string;
  schedule_id: string;
  user_id: string;
};

export const CATEGORIAS_ROTEIRO: {
  value: ScheduleCategory;
  label: string;
}[] = [
  { value: "praia", label: "Praia" },
  { value: "refeicao", label: "Comida" },
  { value: "festa", label: "Festa" },
  { value: "passeio", label: "Passeio" },
  { value: "logistica", label: "Logística" },
  { value: "outros", label: "Outros" },
];
