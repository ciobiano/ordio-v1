import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Ordio — Audio to Video';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage(): ImageResponse {
  // Decorative waveform bar heights
  const bars = [40, 70, 55, 90, 65, 80, 45, 95, 60, 75, 50, 85, 70, 55, 90, 40, 65, 80, 50, 95];

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000000',
          gap: '32px',
        }}
      >
        {/* Waveform bars */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            height: '120px',
          }}
        >
          {bars.map((h, i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: `${h}%`,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '4px',
              }}
            />
          ))}
        </div>

        {/* Title */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div
            style={{
              fontSize: '72px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-2px',
            }}
          >
            Ordio
          </div>
          <div
            style={{
              fontSize: '24px',
              color: 'rgba(255, 255, 255, 0.5)',
              fontWeight: 400,
            }}
          >
            Audio to video, instantly
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
