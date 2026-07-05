import { guarded } from "@/server/api";
import { cachedStats } from "@/server/stats";
import { getEntryPickerOptions } from "@/server/queries/entries";

export const GET = () => guarded(() => cachedStats("entry-options", getEntryPickerOptions));
