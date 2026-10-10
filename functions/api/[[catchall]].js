import { json } from "../_lib/util.js";
// Unknown /api/* paths get a JSON 404 instead of the SPA's index.html
export const onRequest = () => json({ error: "Not found" }, 404);
