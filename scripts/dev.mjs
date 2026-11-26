// Arranque do servidor de desenvolvimento tolerante a caminhos com "#".
//
// Contexto: o directório deste projecto chama-se "## SOF". O Vite resolve os
// módulos com `fs.realpathSync.native`, que devolve SEMPRE o caminho canónico
// (com "#"), e depois converte o id num URL de ficheiro — onde o "#" é lido
// como delimitador de fragmento. Resultado: o Vite não consegue carregar
// `/@vite/client` nem transformar `/src/main.tsx`; o browser recebe JSX cru,
// dá "missing ) after argument list", a app React nunca monta e o ecrã fica
// em branco. É exactamente o aviso que o próprio Vite imprime:
// "The project root contains the '#' character ... Consider renaming the
// directory".
//
// Solução sem renomear nada: quando o caminho contém "#", criamos uma junction
// (directório virtual) com um caminho limpo que aponta para o projecto e
// relançamos o `tsx` a partir dela com `--preserve-symlinks-main
// --preserve-symlinks`. Assim o Node e o Vite nunca resolvem para o caminho
// real com "#" e a transformação funciona. A junction vive ao lado do projecto
// (em NEXUS-GW, que não tem "#") e é segura: apaga a junction, nunca o alvo.
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { stageEsbuildBinary } from './lib/esbuild-binary.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(here, '..');

// Workaround do caminho longo do Windows: o Vite (middleware mode) arranca o
// esbuild, que falha com `spawn ... ENOENT` dentro deste directório. A cópia
// curta é preparada antes de arrancar o servidor e apagada no fim.
const esbuildStage = stageEsbuildBinary(projectDir, {
  log: (message) => console.log(`[dev] ${message}`),
  // O tsx transforma o servidor com a sua própria versão do esbuild (0.28.x),
  // diferente da que o Vite usa; o servidor trata da dele em `entrypoint.ts`.
  from: 'tsx',
});
const devEnv = esbuildStage.env;
// `process.env.GUIGUI_DEV_REEXEC` marca que já relançámos a partir da junction,
// evitando um ciclo infinito de re-execuções.
const alreadyReexecd = process.env.GUIGUI_DEV_REEXEC === '1';

// Caminho limpo para a junction: sobe na árvore de directórios até encontrar um
// ancestral que NÃO contenha "#" (o pai imediato pode ainda ser "## SOF") e cria
// a junction aí. É seguro: apaga a junction, nunca o alvo.
function findCleanAncestor(start) {
  let dir = path.resolve(start);
  // Sobe no máximo 8 níveis à procura de um caminho sem "#".
  for (let i = 0; i < 8; i += 1) {
    if (!dir.includes('#')) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break; // chegámos à raiz
    dir = parent;
  }
  return null;
}

const cleanParent = findCleanAncestor(projectDir);
const hasHash = projectDir.includes('#');
const cwdHasHash = process.cwd().includes('#');
if (hasHash && !alreadyReexecd && cwdHasHash) {
  if (!cleanParent) {
    console.error(
      '[dev] Não foi possível encontrar um directório ancestral sem "#" para ' +
        'criar a junction. Solução definitiva: renomear "## SOF" para um nome ' +
        'sem "#".',
    );
    process.exit(1);
  }
  const junctionPath = path.join(cleanParent, '_guigui-dev-nohash');
  // Recria a junction de forma determinística (rmdir remove só a junction).
  try {
    rmSync(junctionPath, { recursive: true, force: true });
  } catch {
    /* junction pode não existir — ignorar */
  }
  const created = spawnSync(
    'cmd',
    ['/c', 'mklink', '/J', junctionPath, projectDir],
    { stdio: 'ignore' },
  );
  if (created.status !== 0 || !existsSync(junctionPath)) {
    console.error(
      '[dev] Não foi possível criar a junction para contornar o "#" no caminho. ' +
        'A app pode não transformar módulos (ecrã em branco). ' +
        'Solução definitiva: renomear "## SOF" para um nome sem "#".',
    );
    process.exit(1);
  }

  const tsxCli = path.join(junctionPath, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const serverEntry = path.join(junctionPath, 'server', 'entrypoint.ts');
  const nodeArgs = [
    '--preserve-symlinks-main',
    '--preserve-symlinks',
    tsxCli,
    serverEntry,
    ...process.argv.slice(2),
  ];
  const child = spawnSync(process.execPath, nodeArgs, {
    cwd: junctionPath,
    stdio: 'inherit',
    env: { ...devEnv, GUIGUI_DEV_REEXEC: '1' },
  });
  esbuildStage.cleanup();
  process.exit(child.status ?? 0);
}

// Caminho sem "#" (ou já relançado): arranca normalmente com o tsx local.
const tsxCli = path.join(projectDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const serverEntry = path.join(projectDir, 'server', 'entrypoint.ts');
const child = spawnSync(
  process.execPath,
  [...process.execArgv, tsxCli, serverEntry, ...process.argv.slice(2)],
  { stdio: 'inherit', env: devEnv },
);
esbuildStage.cleanup();
process.exit(child.status ?? 0);
