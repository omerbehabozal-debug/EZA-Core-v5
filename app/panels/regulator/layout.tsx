import { generatePageMetadata } from "@/lib/seo";

export const metadata = generatePageMetadata(
  "Regulator Oversight Panel",
  "Küresel ölçekte yapay zekâ sistemleri için içeriksiz, müdahalesiz ve denetlenebilir etik gözetim arayüzü."
);

export default function RegulatorPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

