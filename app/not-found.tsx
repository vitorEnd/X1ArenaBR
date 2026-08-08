import { ArrowLeft, ShieldQuestion } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return <section className="not-found-page"><div><ShieldQuestion size={52} /><span>404 • Fora do card</span><h1>Essa página não entrou na Arena</h1><p>O endereço pode ter mudado ou ainda não existe.</p><Link href="/" className="button-gold"><ArrowLeft size={18} /> Voltar ao início</Link></div></section>;
}
