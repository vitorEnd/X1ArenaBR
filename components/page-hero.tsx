type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageHero({ eyebrow, title, description }: PageHeroProps) {
  return (
    <section className="page-hero">
      <div className="page-container page-hero__content">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display-title">{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
