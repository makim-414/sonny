import { APP_LANG } from "@/lib/brand";
import type { Scene } from "./channels";

// Fake broadcast pictures, one per genre. Pure SVG and CSS, no real video.

// Made-up ticker lines (demo data), in the conversation language.
const HEADLINES =
  APP_LANG === "en"
    ? [
        "Mostly sunny today, high near 64",
        "Free flu shots for seniors through the end of the month",
        "Fall colors peak this weekend in state parks",
        "Bus fares stay the same through next year",
      ]
    : [
        "오늘 전국 대체로 맑음, 낮 기온 18도",
        "어르신 무료 독감 예방접종 이달 말까지",
        "주말 단풍 절정, 국립공원 나들이객 늘어",
        "버스 요금 동결, 내년까지 유지",
      ];

function NewsScene() {
  return (
    <>
      <svg className="tv-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <rect className="tv-s-news-bg" width="1600" height="900" />
        <g className="tv-s-news-globe">
          <circle cx="1180" cy="380" r="260" />
          <ellipse cx="1180" cy="380" rx="260" ry="90" />
          <ellipse cx="1180" cy="380" rx="110" ry="260" />
          <line x1="920" y1="380" x2="1440" y2="380" />
        </g>
        <g className="tv-s-news-anchor">
          <circle cx="560" cy="380" r="78" />
          <path d="M400 640 C400 520 470 470 560 470 C650 470 720 520 720 640 Z" />
        </g>
        <path className="tv-s-news-desk" d="M200 600 L1400 600 L1480 900 L120 900 Z" />
      </svg>
      <div className="tv-ticker">
        <div className="tv-ticker-track">
          {[...HEADLINES, ...HEADLINES].map((h, i) => (
            <span key={i}>{h}</span>
          ))}
        </div>
      </div>
    </>
  );
}

function TrotScene() {
  return (
    <svg className="tv-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <rect className="tv-s-trot-bg" width="1600" height="900" />
      <g className="tv-s-beams">
        <polygon className="tv-s-beam tv-beam-a" points="300,0 380,0 900,900 560,900" />
        <polygon className="tv-s-beam tv-beam-b" points="1220,0 1300,0 1040,900 700,900" />
        <polygon className="tv-s-beam tv-beam-c" points="760,0 840,0 980,900 620,900" />
      </g>
      <g className="tv-s-sparkles">
        {[
          [180, 160],
          [420, 260],
          [1300, 200],
          [1460, 340],
          [980, 120],
          [620, 140],
          [1120, 300],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="8" style={{ animationDelay: `${i * 0.35}s` }} />
        ))}
      </g>
      <ellipse className="tv-s-stage" cx="800" cy="860" rx="760" ry="120" />
      <g className="tv-s-singer">
        <circle cx="800" cy="500" r="52" />
        <path d="M720 780 C720 640 750 570 800 570 C850 570 880 640 880 780 Z" />
        <line className="tv-s-mic" x1="900" y1="540" x2="900" y2="800" />
        <circle cx="900" cy="532" r="14" />
      </g>
    </svg>
  );
}

function DramaScene() {
  return (
    <svg className="tv-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <rect className="tv-s-drama-bg" width="1600" height="900" />
      <circle className="tv-s-drama-sun" cx="1200" cy="420" r="140" />
      <g className="tv-s-houses">
        <path d="M0 620 L160 500 L320 620 L320 900 L0 900 Z" />
        <path d="M300 640 L480 520 L660 640 L660 900 L300 900 Z" />
        <path d="M940 600 L1120 470 L1300 600 L1300 900 L940 900 Z" />
        <path d="M1280 650 L1440 540 L1600 650 L1600 900 L1280 900 Z" />
      </g>
      <g className="tv-s-windows">
        <rect x="120" y="680" width="70" height="60" />
        <rect x="440" y="700" width="70" height="60" />
        <rect x="1080" y="660" width="70" height="60" />
        <rect x="1400" y="710" width="70" height="60" />
      </g>
      <g className="tv-s-people">
        <circle cx="740" cy="640" r="34" />
        <path d="M690 840 C690 740 710 690 740 690 C770 690 790 740 790 840 Z" />
        <circle cx="850" cy="620" r="38" />
        <path d="M795 840 C795 730 818 676 850 676 C882 676 905 730 905 840 Z" />
      </g>
      <rect className="tv-s-road" x="0" y="840" width="1600" height="60" />
    </svg>
  );
}

function NatureScene() {
  return (
    <svg className="tv-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <rect className="tv-s-nature-bg" width="1600" height="900" />
      <circle className="tv-s-nature-sun" cx="1260" cy="200" r="90" />
      <g className="tv-s-birds">
        <path d="M300 180 q20 -20 40 0 q20 -20 40 0" />
        <path d="M400 230 q16 -16 32 0 q16 -16 32 0" />
        <path d="M220 260 q14 -14 28 0 q14 -14 28 0" />
      </g>
      <path className="tv-s-mtn-far" d="M0 560 L260 330 L460 500 L720 280 L1000 520 L1260 360 L1600 560 L1600 900 L0 900 Z" />
      <path className="tv-s-mtn-mid" d="M0 650 L320 470 L620 640 L900 460 L1240 660 L1600 520 L1600 900 L0 900 Z" />
      <path className="tv-s-mtn-near" d="M0 760 L400 620 L800 740 L1200 640 L1600 760 L1600 900 L0 900 Z" />
      <path className="tv-s-river" d="M700 900 C760 820 640 780 760 720 C840 690 900 700 960 680 L1000 680 C920 720 860 740 860 790 C860 840 940 860 980 900 Z" />
    </svg>
  );
}

function TempleScene() {
  return (
    <svg className="tv-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <rect className="tv-s-temple-bg" width="1600" height="900" />
      <path className="tv-s-temple-mtn" d="M0 560 L300 380 L560 520 L820 340 L1120 520 L1400 400 L1600 520 L1600 900 L0 900 Z" />
      <g className="tv-s-temple">
        <path d="M420 520 Q800 440 1180 520 L1120 560 L480 560 Z" />
        <rect x="520" y="560" width="560" height="40" />
        <path d="M480 600 Q800 540 1120 600 L1080 630 L520 630 Z" />
        <rect x="560" y="630" width="480" height="200" />
        <rect className="tv-s-temple-door" x="740" y="700" width="120" height="130" />
        <rect x="440" y="830" width="720" height="40" />
      </g>
      <line className="tv-s-lantern-line" x1="0" y1="120" x2="1600" y2="120" />
      <g className="tv-s-lanterns">
        {[160, 400, 640, 960, 1200, 1440].map((x, i) => (
          <g key={x} style={{ animationDelay: `${i * 0.4}s` }}>
            <line x1={x} y1="120" x2={x} y2="170" />
            <circle className={`tv-lantern-${i % 3}`} cx={x} cy="205" r="36" />
          </g>
        ))}
      </g>
    </svg>
  );
}

function HealthScene() {
  return (
    <svg className="tv-scene-svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
      <rect className="tv-s-health-bg" width="1600" height="900" />
      <circle className="tv-s-health-ring" cx="800" cy="460" r="320" />
      <g className="tv-s-coach">
        <circle cx="800" cy="330" r="56" />
        <path d="M730 640 L740 420 L860 420 L870 640 Z" />
        <g className="tv-s-arms">
          <line x1="750" y1="440" x2="640" y2="300" />
          <line x1="850" y1="440" x2="960" y2="300" />
        </g>
        <line x1="770" y1="640" x2="740" y2="800" />
        <line x1="830" y1="640" x2="860" y2="800" />
      </g>
      <rect className="tv-s-floor" x="0" y="800" width="1600" height="100" />
    </svg>
  );
}

function GenericScene() {
  return (
    <div className="tv-bars">
      {Array.from({ length: 7 }, (_, i) => (
        <i key={i} className={`tv-bar-${i}`} />
      ))}
    </div>
  );
}

export function BroadcastScreen({ scene }: { scene: Scene }) {
  return (
    <div className={`tv-scene tv-scene-${scene}`}>
      {scene === "news" && <NewsScene />}
      {scene === "trot" && <TrotScene />}
      {scene === "drama" && <DramaScene />}
      {scene === "nature" && <NatureScene />}
      {scene === "temple" && <TempleScene />}
      {scene === "health" && <HealthScene />}
      {scene === "generic" && <GenericScene />}
    </div>
  );
}
