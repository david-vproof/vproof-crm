import { CapaFitxa } from "@/components/crm/CapaFitxa";

/** La capa es munta un sol cop: canviar de secció o de client només en canvia el contingut. */
export default function LayoutFitxaClient({ children }: { children: React.ReactNode }) {
  return <CapaFitxa>{children}</CapaFitxa>;
}
