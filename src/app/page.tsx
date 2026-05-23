import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.landingContainer}>
      {/* Hero Section */}
      <header className={styles.hero}>
        <div className={styles.titleBadge}>
          <span>Engine v3 + Live Sales Workshop</span>
        </div>
        <h1 className={styles.title}>
          Black Box <span className={styles.titleAccent}>Magic</span>
        </h1>
        <p className={styles.subtitle}>
          Auditoría de ejecución visual con Inteligencia Artificial para Retail y QSR.
          Analiza tus anaqueles en tiempo real y detecta incidencias críticas al instante.
        </p>
      </header>

      {/* Grid de Portales */}
      <main className={styles.grid}>
        {/* Portal 1: Taller en Vivo */}
        <section className={styles.portalCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardBadge}>
              <span className="badge badge--blue">Interactivo / Ventas</span>
            </div>
            <h2 className={styles.cardTitle}>Taller en Vivo</h2>
            <p className={styles.cardDesc}>
              Presenta la potencia de BBM en vivo frente a tus clientes. Configura reglas conversacionales personalizadas al vuelo, sube fotos en vivo con compresión Canvas integrada y audita con o sin planogramas de referencia.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Link className={`btn btn--primary ${styles.cardBtn}`} href="/demo">
              🚀 ENTRAR AL TALLER
            </Link>
          </div>
        </section>

        {/* Portal 2: Dashboard Real */}
        <section className={styles.portalCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardBadge}>
              <span className="badge badge--green">Operaciones / FOTL</span>
            </div>
            <h2 className={styles.cardTitle}>Dashboard de Control</h2>
            <p className={styles.cardDesc}>
              El centro de mando de las operaciones. Explora el histórico de auditorías, visualiza incidencias geolocalizadas detectadas por Gemini, inspecciona discrepancias de acomodo side-by-side y descarga reportes Excel consolidados.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Link className={`btn btn--secondary ${styles.cardBtn}`} href="/dashboard">
              📊 IR AL DASHBOARD
            </Link>
          </div>
        </section>

        {/* Portal 3: Consola Admin */}
        <section className={styles.portalCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardBadge}>
              <span className="badge badge--yellow">Sesiones B2B</span>
            </div>
            <h2 className={styles.cardTitle}>Consola Admin</h2>
            <p className={styles.cardDesc}>
              Control total para el equipo de ventas. Genera códigos de onboarding conversacional válidos por 7 días para tus prospectos y lanza talleres de ventas interactivos pre-configurados para su email en un solo clic.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Link className={`btn btn--secondary ${styles.cardBtn}`} href="/admin">
              ⚙️ ACCESO ADMIN
            </Link>
          </div>
        </section>
      </main>

      {/* Sección de las 7 Facetas */}
      <section className={styles.facetsSection}>
        <h3 className={styles.facetsTitle}>
          <span>🔍</span> Las 7 Capas de Análisis Visual AI
        </h3>
        <div className={styles.facetsGrid}>
          <div className={styles.facetItem}>
            <span className={styles.facetName}>📦 1. Inventario</span>
            <span className={styles.facetDesc}>Detecta presencia y stock out de productos/SKUs en tiempo real.</span>
          </div>
          <div className={styles.facetItem}>
            <span className={styles.facetName}>📊 2. Share de Repisa</span>
            <span className={styles.facetDesc}>Mide la participación de marca frente a los competidores en el anaquel.</span>
          </div>
          <div className={styles.facetItem}>
            <span className={styles.facetName}>🏷️ 3. Precios y P.O.P.</span>
            <span className={styles.facetDesc}>Audita visibilidad y correspondencia de etiquetas de precios y material publicitario.</span>
          </div>
          <div className={styles.facetItem}>
            <span className={styles.facetName}>📋 4. Compliance</span>
            <span className={styles.facetDesc}>Valida el acomodo exacto contra el planograma o la guía comercial.</span>
          </div>
          <div className={styles.facetItem}>
            <span className={styles.facetName}>✨ 5. Condiciones</span>
            <span className={styles.facetDesc}>Monitorea la higiene, desorden, roturas y estado físico general de la tienda.</span>
          </div>
          <div className={styles.facetItem}>
            <span className={styles.facetName}>👁️ 6. Contexto</span>
            <span className={styles.facetDesc}>Identifica factores ambientales, afluencia y calidad de la iluminación.</span>
          </div>
          <div className={styles.facetItem}>
            <span className={styles.facetName}>🎯 7. Estrategia</span>
            <span className={styles.facetDesc}>Genera recomendaciones de negocio accionables listas para los promotores.</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <span>BLACK BOX MAGIC © 2026</span>
        <span style={{ margin: '0 1rem' }}>|</span>
        <span>AUDITORÍA VISUAL CON IA ULTRA-VELOZ</span>
      </footer>
    </div>
  );
}
