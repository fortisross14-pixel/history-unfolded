// Renders every page and detail panel to HTML against a simulated world, so UI
// crashes show up without a browser: node scripts/ui-smoke.ts [years]
import { createServer } from 'vite';

const years = Number(process.argv[2] ?? '2500');
const server = await createServer({
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
});
try {
  const mod = await server.ssrLoadModule('/src/dev/smoke.tsx');
  const failures: string[] = await mod.renderAll(years);
  if (failures.length) {
    console.error(`${failures.length} UI render failures:`);
    for (const f of failures) console.error('  ' + f);
    process.exitCode = 1;
  } else console.log('All pages rendered.');
} finally {
  await server.close();
}
