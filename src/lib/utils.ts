export const BASENAME =
  process.env.NODE_ENV !== "production"
    ? "http://localhost:3000"
    : "https://www.pantherkolab.com";

export function logDebug(...args: any[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[DEBUG]", ...args);
  }
}

