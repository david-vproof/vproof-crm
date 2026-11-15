import Link from "next/link";

import { EstatBuit } from "@/components/UI";

export default function NoTrobat() {
  return (
    <div className="mx-auto max-w-[1180px] px-6 py-16 lg:px-10">
      <EstatBuit titol="Celler no trobat" text="Aquest celler no és a la còpia de FactuSol del portal." />
      <p className="mt-6 text-center text-[14px]">
        <Link href="/cellers" className="text-wine hover:underline">
          Torna al llistat
        </Link>
      </p>
    </div>
  );
}
