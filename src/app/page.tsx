import { redirect } from "next/navigation";

// The app's home is the dashboard inside the authenticated shell. The shell
// layout ((app)/layout.tsx) enforces auth and sends signed-out users to /login.
export default function RootPage() {
  redirect("/dashboard");
}
