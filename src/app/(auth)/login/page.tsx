import { AuthShell } from "../AuthShell";
import { AuthFlow } from "../AuthFlow";

export const metadata = { title: "Log in" };

export default function Page() {
  return (
    <AuthShell title="Welcome to Dashpad" subtitle="Log in or create an account. Just your email to start.">
      <AuthFlow />
    </AuthShell>
  );
}
