import { useState } from 'react';
import { GripVertical } from 'lucide-react';

interface CompareSliderProps {
  originalUrl: string;
  processedUrl: string;
  originalAlt: string;
  processedAlt: string;
}

export function CompareSlider({
  originalUrl,
  processedUrl,
  originalAlt,
  processedAlt,
}: CompareSliderProps) {
  const [position, setPosition] = useState(50);

  return (
    <div className="compare-slider">
      <div className="compare-stage">
        <img src={originalUrl} alt={originalAlt} className="compare-image" loading="lazy" />
        <div className="compare-processed" style={{ clipPath: `inset(0 0 0 ${position}%)` }}>
          <img src={processedUrl} alt={processedAlt} className="compare-image" loading="lazy" />
        </div>
        <span className="compare-label compare-label-left">Original</span>
        <span className="compare-label compare-label-right">Processed</span>
        <span className="compare-divider" style={{ left: `${position}%` }} aria-hidden="true">
          <span>
            <GripVertical size={17} />
          </span>
        </span>
      </div>
      <label className="sr-only" htmlFor="comparison-position">
        Before and after comparison position
      </label>
      <input
        id="comparison-position"
        className="compare-range"
        type="range"
        min={0}
        max={100}
        value={position}
        onChange={(event) => setPosition(Number(event.target.value))}
        aria-valuetext={`${position}% processed image visible`}
      />
    </div>
  );
}
