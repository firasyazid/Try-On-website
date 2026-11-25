import Link from "next/link";
import styles from "./site-header.module.css";

export function SiteHeader({ showroom = false }: { showroom?: boolean }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.wordmark}>
        TryOn
      </Link>
      <nav className={styles.navigation} aria-label="Main navigation">
        <Link href={showroom ? "/#collection" : "#collection"} className={styles.collectionLink}>
          Collection
        </Link>
        <Link href="/showroom" aria-current={showroom ? "page" : undefined} className={styles.collectionLink}>
          Showroom
        </Link>
      </nav>
    </header>
  );
}
