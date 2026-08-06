import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Generate dynamic favicon with a white background square for the logo
export default function Icon() {
  let logoBase64 = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.png');
    const logoData = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoData.toString('base64')}`;
  } catch (error) {
    console.error('Failed to load logo for favicon generation', error);
  }

  return new ImageResponse(
    (
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          padding: '2px',
        }}
      >
        {logoBase64 ? (
          <img
            src={logoBase64}
            alt="Logo"
            style={{
              width: '26px',
              height: '26px',
              objectFit: 'contain',
            }}
          />
        ) : (
          // fallback placeholder just in case
          <div style={{ width: '20px', height: '20px', background: '#58326A', borderRadius: '2px' }} />
        )}
      </div>
    ),
    {
      ...size,
    }
  );
}
