import styles from './marketing.module.css';

/** Static bipartite mock: sources on top, spine in the middle, concepts below. */
const NODES = {
  photo: { x: 50, y: 52, label: 'Photosynthesis', kind: 'spine' as const },
  chloro: { x: 24, y: 80, label: 'Chloroplast', kind: 'concept' as const },
  light: { x: 76, y: 80, label: 'Light reaction', kind: 'concept' as const },
  video: { x: 20, y: 30, label: '▶ Crash Course', kind: 'source' as const },
  article: { x: 50, y: 16, label: '◆ Chloroplasts article', kind: 'source' as const },
  chat: { x: 80, y: 30, label: '✦ Light vs dark', kind: 'source' as const },
};

const EDGES: Array<{ from: keyof typeof NODES; to: keyof typeof NODES; spine?: boolean }> = [
  { from: 'video', to: 'photo', spine: true },
  { from: 'article', to: 'photo', spine: true },
  { from: 'chat', to: 'photo', spine: true },
  { from: 'photo', to: 'chloro' },
  { from: 'photo', to: 'light' },
];

function nodeClass(kind: (typeof NODES)[keyof typeof NODES]['kind']): string {
  if (kind === 'spine') return `${styles.mapNodeConcept} ${styles.mapNodeSpine}`;
  if (kind === 'concept') return styles.mapNodeConcept;
  return styles.mapNodeSource;
}

/** Straight on the center axis; otherwise a light outward bow so spokes don't look like a starburst. */
function edgePath(from: keyof typeof NODES, to: keyof typeof NODES): string {
  const a = NODES[from];
  const b = NODES[to];
  if (Math.abs(a.x - b.x) < 2) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const outward = mx >= 50 ? 8 : -8;
  return `M ${a.x} ${a.y} Q ${mx + outward} ${my} ${b.x} ${b.y}`;
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
              <svg
                className={styles.mapEdges}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {EDGES.map((e) => (
                  <path
                    key={`${e.from}-${e.to}`}
                    d={edgePath(e.from, e.to)}
                    className={`${styles.mapEdge}${e.spine ? ` ${styles.mapEdgeSpine}` : ''}`}
                  />
                ))}
              </svg>
              {Object.entries(NODES).map(([id, node]) => (
                <span
                  key={id}
                  className={`${styles.mapNode} ${nodeClass(node.kind)}`}
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
