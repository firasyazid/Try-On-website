import { SiteHeader } from "@/components/site-header";
import { CollectionHero } from "@/features/collection/collection-hero";

export default function HomePage() {
  return (
    <>
      <div className="page-shell">
        <SiteHeader />
      </div>
      <main>
        <CollectionHero />
      </main>
    </>
  );
}
