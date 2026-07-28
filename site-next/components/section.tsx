export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-32 py-14 first:pt-10">
      <div className="mb-8 max-w-2xl">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-link">{eyebrow}</span>
        <h2 className="mt-2 font-display text-2xl font-medium tracking-tight text-text sm:text-3xl">{title}</h2>
        {lead && <p className="mt-3 text-base leading-relaxed text-text-muted">{lead}</p>}
      </div>
      {children}
    </section>
  );
}
