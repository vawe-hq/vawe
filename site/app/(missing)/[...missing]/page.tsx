import { notFound } from "next/navigation";
import { logMissing } from "../../../lib/missing";

// Catches every URL that no route owns, so the 404 is logged for bots.
export default async function Missing({ params }: { params: Promise<{ missing: string[] }> }) {
  const { missing } = await params;
  await logMissing(`/${missing.join("/")}`);
  notFound();
}
