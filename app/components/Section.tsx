import FadeIn from "./FadeIn";

interface SectionProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  fadeIn?: boolean;
}

export default function Section({
  children,
  id,
  className = "",
  fadeIn = true,
}: SectionProps) {
  const content = (
    <section
      id={id}
      className={`py-24 md:py-32 lg:py-40 px-6 sm:px-8 lg:px-12 ${className}`}
    >
      {children}
    </section>
  );

  if (fadeIn) {
    return <FadeIn>{content}</FadeIn>;
  }

  return content;
}
