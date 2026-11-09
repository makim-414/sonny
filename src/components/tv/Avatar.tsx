export type AvatarMood = "idle" | "speaking" | "listening" | "thinking";

// A friendly grandchild face drawn in SVG. Colors come from the tv-av-* tokens.
export function Avatar({ mood }: { mood: AvatarMood }) {
  return (
    <div className={`tv-avatar is-${mood}`} aria-hidden>
      <svg viewBox="0 0 200 220" className="tv-avatar-svg">
        <ellipse className="tv-av-shadow" cx="100" cy="212" rx="62" ry="7" />
        <g className="tv-av-body">
          <path className="tv-av-shirt" d="M36 220 C36 182 62 166 100 166 C138 166 164 182 164 220 Z" />
          <path className="tv-av-collar" d="M82 168 L100 188 L118 168 Z" />
        </g>
        <g className="tv-av-head">
          <circle className="tv-av-skin" cx="38" cy="108" r="12" />
          <circle className="tv-av-skin" cx="162" cy="108" r="12" />
          <ellipse className="tv-av-hair" cx="100" cy="84" rx="68" ry="58" />
          <circle className="tv-av-skin" cx="100" cy="108" r="62" />
          <path className="tv-av-hair" d="M40 96 C44 52 76 36 104 38 C136 40 160 58 162 96 C146 78 124 70 100 72 C80 72 60 80 40 96 Z" />
          <g className="tv-av-eyes">
            <ellipse className="tv-av-ink" cx="78" cy="108" rx="7" ry="9" />
            <ellipse className="tv-av-ink" cx="122" cy="108" rx="7" ry="9" />
            <circle className="tv-av-shine" cx="80.5" cy="104.5" r="2.4" />
            <circle className="tv-av-shine" cx="124.5" cy="104.5" r="2.4" />
          </g>
          <ellipse className="tv-av-cheek" cx="64" cy="128" rx="11" ry="7" />
          <ellipse className="tv-av-cheek" cx="136" cy="128" rx="11" ry="7" />
          <path className="tv-av-smile" d="M84 136 Q100 150 116 136" />
          <ellipse className="tv-av-mouth" cx="100" cy="140" rx="11" ry="8" />
        </g>
      </svg>
      <span className="tv-avatar-dots">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
