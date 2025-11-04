import { parameterStore } from "@/lib/parameterStore";

export const CHIME_MAX_ATTENDEES = await parameterStore.getParameter(
  "chime/max-attendees"
); //default 100
