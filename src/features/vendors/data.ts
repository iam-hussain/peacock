import type { VendorDTO, ChitDetailDTO, GeneralDetailDTO } from "@/server/queries/vendors";

// Types are owned by the DB query layer; alias here so feature code keeps a
// stable local import path and stays in sync with the DTOs.
export type Vendor = VendorDTO;
export type VendorType = VendorDTO["type"];
export type ChitDetail = ChitDetailDTO;
export type GeneralDetail = GeneralDetailDTO;
