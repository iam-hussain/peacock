export type Dir = "in" | "out" | "neutral";
export type Role = "treasurer" | "member" | "vendor";

export interface Party {
  name: string;
  role: Role;
}
export interface Txn {
  id: string;
  what: string;
  dir: Dir;
  from: Party;
  to: Party;
  date: string;
  entered: string;
  method: string;
  amount: string;
}
