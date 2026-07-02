import type { VendorDTO, ChitDetailDTO, GeneralDetailDTO } from "@/server/queries/vendors";

// Types are owned by the DB query layer; alias here so feature code keeps a
// stable local import path and stays in sync with the DTOs.
export type Vendor = VendorDTO;
export type VendorType = VendorDTO["type"];
export type ChitDetail = ChitDetailDTO;
export type GeneralDetail = GeneralDetailDTO;

// ponytail: stub vendor directory still consumed by the entries picker
// (src/features/entries/add-entry.tsx); swap to a shared DB-backed directory
// when that feature is rewired.
export const VENDORS: Vendor[] = [
  { id: "hdfc-bank", name: "HDFC Bank FD", ini: "HB", type: "general", typeLabel: "BANK", category: "Bank", status: "active", statusLabel: "Active", cycle: "12-month FD", invested: "₹3.0L", roi: "+7.1%", roiPositive: true, profit: "+₹21,300" },
  { id: "sri-chit", name: "Sri Chit Fund", ini: "SC", type: "chit", typeLabel: "CHIT", category: "Chit", status: "active", statusLabel: "Running", cycle: "20-month chit", invested: "₹2.5L", roi: "−4.0%", roiPositive: false, profit: "−₹10,000" },
  { id: "zerodha", name: "Zerodha Equity", ini: "ZE", type: "general", typeLabel: "STOCKS", category: "Stocks", status: "active", statusLabel: "Active", cycle: "open position", invested: "₹2.0L", roi: "+22.5%", roiPositive: true, profit: "+₹45,000" },
  { id: "muthoot", name: "Muthoot Gold Bond", ini: "MG", type: "general", typeLabel: "GOLD", category: "Gold", status: "active", statusLabel: "Active", cycle: "24-month bond", invested: "₹2.0L", roi: "+9.2%", roiPositive: true, profit: "+₹18,400" },
];
