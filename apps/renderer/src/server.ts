import express from 'express';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { JobConfigSchema } from '@Ordio/shared/schemas';

const app = express();
app.use(express.json());

const port = process.env.PORT || 8000;

app.post('/render', async (req, res) => {
  try {
    const body = req.body;
    
    // Validate input using shared schema
    // Note: The body might wrap the config, or be the config itself. 
    // For now assuming body IS the JobConfig for simplicity
    const inputProps = JobConfigSchema.parse(body);

    const bundleLocation = await import('./index'); // This won't work directly in node without bundling first
    // In a real setup, we use serveUrl or bundle the composition first.
    // For this MVP, we will rely on 'remotion render' CLI or on-the-fly bundling if possible.
    // BUT optimal way for Docker is `bundle`.

    // AUTOMATIC BUNDLING
    const { bundle } = await import('@remotion/bundler');
    // const { webpackOverride } = await import('./webpack-override'); // We might need this

    const bundled = await bundle({
        entryPoint: path.join(__dirname, './index.ts'),
        // If we need custom webpack config
    });

    const composition = await selectComposition({
        serveUrl: bundled,
        id: 'Audiogram',
        inputProps,
    });

    const outputLocation = `/tmp/render-${Date.now()}.mp4`;

    await renderMedia({
        composition,
        serveUrl: bundled,
        codec: 'h264',
        outputLocation,
        inputProps,
    });

    console.log(`Rendered to ${outputLocation}`);
    
    // In production, we would upload this file to S3/R2 and return the URL
    // For MVP, just confirming success
    res.json({ success: true, path: outputLocation });

  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(port, () => {
    console.log(`Renderer server listening on port ${port}`);
});
