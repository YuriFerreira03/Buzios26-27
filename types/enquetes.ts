export type Poll = {
  id: string;
  question: string;
  details: string | null;
  multi: boolean;
  closes_at: string | null;
  closed_at: string | null;
  decision_note: string | null;
  created_by: string;
  created_at: string;
};

export type PollOption = {
  id: string;
  poll_id: string;
  label: string;
  position: number;
};

export type PollVote = {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
};
