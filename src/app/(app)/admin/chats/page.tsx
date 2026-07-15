"use client";

import { BrandLoader } from "@/components/shared/brand-loader";
import { ChatStats } from "@/features/admin/components/chat-stats";
import { usePageQuery } from "@/lib/use-page-query";
import type { WhatsappStats } from "@/server/queries/whatsapp-stats";

export default function AdminChatsPage() {
  const { data, error } = usePageQuery<WhatsappStats>(["admin-chats"], "/api/admin/chats");
  if (error) throw error;
  if (!data) return <BrandLoader />;
  return <ChatStats data={data} />;
}
