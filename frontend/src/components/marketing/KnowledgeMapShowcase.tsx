import type { CSSProperties } from 'react';
import styles from './marketing.module.css';

/** Static bipartite mock: sources ↔ concepts for the Biology / photosynthesis demo. */
const NODES = {
  photo: { x: 50, y: 42, label: 'Photosynthesis', kind: 'spine' as const },
  chloro: { x: 28, y: 68, label: 'Chloroplast', kind: 'concept' as const },
  light: { x: 72, y: 68, label: 'Light reaction', kind: 'concept' as const },
  video: { x: 22, y: 28, label: '▶ Crash Course', kind: 'source' as const },
  article: { x: 50, y: 18, label: '◆ Chloroplasts article', kind: 'source' as const },
  chat: { x: 78, y: 28, label: '✦ Light vs dark', kind: 'source' as const },
};

const EDGES: Array<{ from: keyof typeof NODES; to: keyof typeof NODES; spine?: boolean }> = [
  { from: 'video', to: 'photo', spine: true },
  { from: 'article', to: 'photo', spine: true },
  { from: 'chat', to: 'photo', spine: true },
  { from: 'video', to: 'chloro' },
  { from: 'article', to: 'chloro' },
  { from: 'chat', to: 'light' },
  { from: 'photo', to: 'light' },
];

function edgeStyle(from: keyof typeof NODES, to: keyof typeof NODES): CSSProperties {
  const a = NODES[from];
  const b = NODES[to];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return {
    left: `${a.x}%`,
    top: `${a.y}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`,
  };
}

export function KnowledgeMapShowcase() {
  return (
    <div className={`${styles.sec} ${styles.divide}`} id="map">
      <div className={styles.wrap}>
        <div className={styles.plate}>
          <span className={styles.platenum}>05</span>
          <span className={styles.label}>Knowledge map</span>
          <span className={styles.plateline} />
        </div>
        <div className={styles.showcaseGrid}>
          <div>
            <h2 className={`${styles.serif} ${styles.showcaseTitle}`}>
              See how your learning
              <br />
              <span className={`${styles.it} ${styles.accent}`}>connects.</span>
            </h2>
            <p className={`${styles.dim} ${styles.showcaseCopy}`}>
              As you capture, exomemri pulls out the concepts you actually
              studied and draws how your sources link together — so overlapping
              videos and articles become one map, not a pile of duplicates.
            </p>
            <p className={`${styles.dim} ${styles.showcaseCopy}`}>
              Shared ideas rise to the spine of the map. Click a concept to
              see every source that taught it.
            </p>
          </div>
          <div className={styles.mapMock}>
            <div className={styles.winBar}>
              <span className={`${styles.tl} ${styles.tlAmber}`} />
              <span className={`${styles.tl} ${styles.tlSage}`} />
              <span className={`${styles.tl} ${styles.tlClay}`} />
              <span className={styles.mono}>Biology · knowledge map</span>
            </div>
            <div className={styles.mapCanvas} aria-hidden="true">
              {EDGES.map((e) => (
                <span
                  key={`${e.from}-${e.to}`}
                  className={`${styles.mapEdge}${e.spine ? ` ${styles.mapEdgeSpine}` : ''}`}
                  style={edgeStyle(e.from, e.to)}
                />
              ))}
              {Object.entries(NODES).map(([id, node]) => (
                <span
                  key={id}
                  className={`${styles.mapNode} ${
                    node.kind === 'spine'
                      ? `${styles.mapNodeConcept} ${styles.mapNodeSpine}`
                      : node.kind === 'concept'
                        ? styles.mapNodeConcept
                        : styles.mapNodeSource
                  }`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                  {node.label}
                </span>
              ))}
            </div>
            <div className={styles.mapLegend}>
              <span>
                <span className={`${styles.mapLegendDot} ${styles.mapLegendConcept}`} />
                Concepts
              </span>
              <span>
                <span className={`${styles.mapLegendDot} ${styles.mapLegendSource}`} />
                Sources
              </span>
              <span>Spine = connects more than one source</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
