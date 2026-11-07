import { build } from 'esbuild';
await build({
  entryPoints: ['src/beam-input.jsx'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  outfile: 'assets/beam-input.js',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked'
});
