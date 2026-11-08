import { build } from 'esbuild';
import { copyFile } from 'node:fs/promises';
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
await build({entryPoints:['src/admin.js'],bundle:true,minify:true,format:'iife',target:['es2020'],outfile:'assets/admin.js',legalComments:'linked'});
await copyFile('node_modules/leaflet/dist/leaflet.css','assets/leaflet.css');
