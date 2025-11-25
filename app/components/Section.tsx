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
      className={`py-16 md:py-24 px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </section>
  );

  if (fadeIn) {
    return <FadeIn>{content}</FadeIn>;
  }

  return content;
}

