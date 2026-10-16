import { toast } from "@/components/ui/use-toast";

// Friendly, non-blocking messages (replaces window.alert).
export const notifyError = (e) =>
  toast({
    variant: "destructive",
    title: "Something went wrong",
    description: typeof e === "string" ? e : (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || "Please try again.",
  });
export const notifySuccess = (title, description) => toast({ title, description });
