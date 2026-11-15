import { redirect } from "next/navigation";

export default function Inici() {
  // El middleware ja ha garantit que hi ha sessió en arribar aquí. El CRM és
  // l'únic mòdul operatiu, així que és on s'entra.
  redirect("/crm");
}
