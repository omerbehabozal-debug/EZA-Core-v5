import { Metadata } from "next";

export const defaultMetadata: Metadata = {
  title: "EZA.global - Teknolojinin İnsanlığa Karşı Etik Davranmasını Sağlayan Rehber",
  description: "EZA, insan ve teknoloji arasında etik bir köprü kurar. Yasaklamaz, ceza vermez; sadece daha iyi bir davranış önerir.",
  keywords: ["etik AI", "teknoloji etiği", "AI güvenliği", "etik yönlendirme", "EZA"],
  openGraph: {
    title: "EZA.global - Etik Teknoloji Rehberi",
    description: "Teknolojinin insanlığa karşı etik davranmasını sağlayan rehber.",
    type: "website",
  },
};

export function generatePageMetadata(
  title: string,
  description: string
): Metadata {
  return {
    title: `${title} | EZA.global`,
    description,
    openGraph: {
      title: `${title} | EZA.global`,
      description,
      type: "website",
    },
  };
}

