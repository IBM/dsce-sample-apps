import React from 'react';
import styles from './App.module.scss';
import LiveActivity from './Components/LiveActivity/LiveActivity';
import DisplayData from './Components/DisplayData/DisplayData';
import { Loading } from '@carbon/react';
import { useData } from './DataContext';


const App = () => {
  const { isReady } = useData();

  return (
    <div className={styles.appShell}>
      <header className={styles.topBar}>
        <div className={styles.brand}>
          <span className={styles.brandAccent} />
          <span className={styles.brandText}>A2-D2</span>
          <span className={styles.brandSubtitle}>Aerial Analysis &amp; Drone Detection</span>
        </div>
        <span className={styles.demoTag}>DEMO</span>
      </header>

      <main className={styles.mainLayout}>
        <section className={styles.mapPane}>
          {isReady ? (
            <LiveActivity />
          ) : (
            <div className={styles.loader}>
              <Loading active withOverlay={false} small={false} />
              <span className={styles.loaderText}>Initializing demo feed…</span>
            </div>
          )}
        </section>

        <aside className={styles.sidebar}>
          <DisplayData />
        </aside>
      </main>
    </div>
  );
};

export default App;
