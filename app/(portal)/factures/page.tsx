import { SeccioPendent } from "@/components/SeccioPendent";
import { exigeixVeuTot } from "@/lib/sessio-actual";

export default async function Pagina() {
  await exigeixVeuTot();
  return <SeccioPendent href="/factures" />;
}
