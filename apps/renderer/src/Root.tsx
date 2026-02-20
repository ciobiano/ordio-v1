import { Composition } from 'remotion';
import { Audiogram } from './Composition';
import { JobConfigSchema } from '@Ordio/shared/schemas';
import { z } from 'zod';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Audiogram"
        component={Audiogram}
        durationInFrames={30 * 10} // Default 10s
        fps={30}
        width={1080}
        height={1920}
        schema={JobConfigSchema}
        defaultProps={{
          timeline: {
            words: [],
            duration: 10,
          },
          style: {
            width: 1080,
            height: 1920,
            backgroundColor: '#000000',
            textColor: '#ffffff',
            fontFamily: 'Inter',
            fontSize: 48,
            waveColor: '#ff0000',
          },
          audioStorageId: 'default',
        }}
      />
    </>
  );
};
