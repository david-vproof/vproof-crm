import Link from "next/link";

import { EstatBuit } from "@/components/UI";

export default function NoTrobat() {
  return (
    <div className="mx-auto max-w-[1180px] px-6 py-16 lg:px-10">
      <EstatBuit titol="Client no trobat" text="Aquest codi no existeix al fitxer de clients de l'exercici actual." />
      <p className="mt-6 text-center text-[14px]">
        <Link href="/clients" className="text-wine hover:underline">
          Torna al llistat
        </Link>
      </p>
    </div>
  );
}
