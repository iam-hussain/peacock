"use client";

import { Transactions } from "@/features/transactions/components/transactions";

// Fetching (filters → /api/transactions, server-paged) lives inside <Transactions/>.
export default function TransactionsPage() {
  return <Transactions />;
}
