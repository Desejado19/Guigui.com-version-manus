import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export interface DiscoveredRoute {
  method: string;
  path: string;
  sources: string[];
  aliases: string[];
}

export interface RouteDiscoveryResult {
  routes: DiscoveredRoute[];
  unresolved: string[];
}

interface SourceFile {
  filePath: string;
  source: string;
}

interface RouteRegistration {
  method: string;
  path: string;
  line: number;
  node: ts.CallExpression;
  unresolvedReason?: string;
}

const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

function collectTypeScriptFiles(directory: string): string[] {
  if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) return [];

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [entryPath] : [];
  });
}

function stringValue(node: ts.Expression | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function propertyName(node: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text.toLowerCase();
  return undefined;
}

function routeCalls(source: ts.SourceFile, receiverName: string): RouteRegistration[] {
  const routes: RouteRegistration[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === receiverName
        && expression.name.text.toLowerCase() === 'all') {
        routes.push({
          method: '',
          path: '',
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          node,
          unresolvedReason: `${receiverName}.all requires explicit method expansion`,
        });
      } else if (ts.isPropertyAccessExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === receiverName
        && httpMethods.has(expression.name.text.toLowerCase())) {
        const routePath = stringValue(node.arguments[0]);
        routes.push({
          method: expression.name.text.toUpperCase(),
          path: routePath ?? '',
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          node,
          ...(routePath === undefined ? { unresolvedReason: `computed ${receiverName} route path` } : {}),
        });
      } else if (ts.isElementAccessExpression(expression)
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === receiverName) {
        const methodName = stringValue(expression.argumentExpression)?.toLowerCase();
        const routePath = stringValue(node.arguments[0]);
        if (methodName && httpMethods.has(methodName) && routePath !== undefined) {
          routes.push({
            method: methodName.toUpperCase(),
            path: routePath,
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            node,
          });
          ts.forEachChild(node, visit);
          return;
        }
        routes.push({
          method: '',
          path: '',
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          node,
          unresolvedReason: methodName && httpMethods.has(methodName)
            ? `computed ${receiverName} route path`
            : `computed ${receiverName} route method`,
        });
      } else if (ts.isPropertyAccessExpression(expression)
        && expression.name.text === 'route'
        && ts.isIdentifier(expression.expression)
        && expression.expression.text === receiverName) {
        routes.push({
          method: '',
          path: '',
          line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          node,
          unresolvedReason: `${receiverName}.route chaining`,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return routes;
}

function resolveImportedModules(rootDir: string, source: ts.SourceFile): Map<string, string> {
  const modules = new Map<string, string>();

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.importClause) continue;
    const moduleSpecifier = stringValue(statement.moduleSpecifier);
    if (!moduleSpecifier?.startsWith('.')) continue;

    const importedFile = path.resolve(path.dirname(source.fileName), moduleSpecifier);
    const candidates = [`${importedFile}.ts`, `${importedFile}.tsx`, path.join(importedFile, 'index.ts')];
    const resolvedFile = candidates.find((candidate) => statSync(candidate, { throwIfNoEntry: false })?.isFile());
    if (!resolvedFile || !path.resolve(resolvedFile).startsWith(path.resolve(rootDir))) continue;

    const bindings = statement.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        modules.set(element.name.text, resolvedFile);
      }
    }
    if (statement.importClause.name) modules.set(statement.importClause.name.text, resolvedFile);
  }

  return modules;
}

function exportedFunctionNames(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (ts.isFunctionDeclaration(statement)
      && statement.name
      && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      names.add(statement.name.text);
    }
    if (ts.isVariableStatement(statement)
      && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    }
  }
  return names;
}

function isApiV1Rewrite(source: ts.SourceFile): boolean {
  let detected = false;
  function visit(node: ts.Node) {
    if (ts.isIfStatement(node)) {
      const condition = node.expression.getText(source);
      const body = node.thenStatement.getText(source);
      if (condition.includes('/api/v1/') && body.includes('req.url') && body.includes('/api')) detected = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return detected;
}

function joinRoutePath(prefix: string, routePath: string): string {
  const joined = `/${[prefix, routePath].map((part) => part.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')}`;
  return joined === '/' ? '/' : joined.replace(/\/+$/, '');
}

function toRelativePath(rootDir: string, filePath: string): string {
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

export function discoverExpressRoutes(rootDir: string): RouteDiscoveryResult {
  const absoluteRoot = path.resolve(rootDir);
  const serverEntry = path.join(absoluteRoot, 'server.ts');
  const filePaths = [
    ...(statSync(serverEntry, { throwIfNoEntry: false })?.isFile() ? [serverEntry] : []),
    ...collectTypeScriptFiles(path.join(absoluteRoot, 'server')),
  ];
  const files: SourceFile[] = filePaths.map((filePath) => ({
    filePath: path.resolve(filePath),
    source: readFileSync(filePath, 'utf8'),
  }));
  const parsedFiles = new Map(files.map(({ filePath, source }) => [
    filePath,
    ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
  ]));
  const routes = new Map<string, DiscoveredRoute>();
  const unresolved = new Set<string>();
  const mainSource = parsedFiles.get(path.resolve(serverEntry));
  const apiV1Rewrite = mainSource ? isApiV1Rewrite(mainSource) : false;
  if (!mainSource) unresolved.add('server.ts:1: missing Express server entrypoint');

  function addRoute(method: string, routePath: string, relativeSource: string, line: number) {
    const key = `${method} ${routePath}`;
    const record = routes.get(key) ?? { method, path: routePath, sources: [], aliases: [] };
    const location = `${relativeSource}:${line}`;
    if (!record.sources.includes(location)) record.sources.push(location);
    if (apiV1Rewrite && routePath.startsWith('/api/')) {
      const alias = `/api/v1${routePath.slice('/api'.length)}`;
      if (!record.aliases.includes(alias)) record.aliases.push(alias);
    }
    routes.set(key, record);
  }

  if (mainSource) {
    const sourcePath = toRelativePath(absoluteRoot, serverEntry);
    for (const registration of routeCalls(mainSource, 'app')) {
      if (registration.unresolvedReason) {
        unresolved.add(`${sourcePath}:${registration.line}: ${registration.unresolvedReason}`);
        continue;
      }
      addRoute(registration.method, registration.path, sourcePath, registration.line);
    }

    const imports = resolveImportedModules(absoluteRoot, mainSource);
    for (const node of mainSource.statements) {
      if (!ts.isExpressionStatement(node) || !ts.isCallExpression(node.expression)) continue;
      const call = node.expression;
      if (!ts.isPropertyAccessExpression(call.expression)
        || !ts.isIdentifier(call.expression.expression)
        || call.expression.expression.text !== 'app'
        || call.expression.name.text !== 'use') continue;

      const mountPath = stringValue(call.arguments[0]);
      const routerCall = call.arguments[1];
      if (mountPath === undefined || !routerCall) continue;
      if (!ts.isCallExpression(routerCall) || !ts.isIdentifier(routerCall.expression)) {
        if (ts.isIdentifier(routerCall)) {
          unresolved.add(`${sourcePath}:${mainSource.getLineAndCharacterOfPosition(node.getStart(mainSource)).line + 1}: unresolved router mount`);
        }
        continue;
      }

      const modulePath = imports.get(routerCall.expression.text);
      const routerSource = modulePath ? parsedFiles.get(path.resolve(modulePath)) : undefined;
      if (!routerSource || !exportedFunctionNames(routerSource).has(routerCall.expression.text)) {
        unresolved.add(`${sourcePath}:${mainSource.getLineAndCharacterOfPosition(node.getStart(mainSource)).line + 1}: unresolved router factory ${routerCall.expression.text}`);
        continue;
      }

      const routerFile = toRelativePath(absoluteRoot, routerSource.fileName);
      for (const registration of routeCalls(routerSource, 'router')) {
        if (registration.unresolvedReason) {
          unresolved.add(`${routerFile}:${registration.line}: ${registration.unresolvedReason}`);
          continue;
        }
        addRoute(registration.method, joinRoutePath(mountPath, registration.path), routerFile, registration.line);
      }
    }
  }

  for (const [filePath, source] of parsedFiles) {
    if (filePath === path.resolve(serverEntry)) continue;
    for (const registration of routeCalls(source, 'router')) {
      if (registration.unresolvedReason) {
        unresolved.add(`${toRelativePath(absoluteRoot, filePath)}:${registration.line}: ${registration.unresolvedReason}`);
      } else if (![...routes.values()].some((route) => route.sources.includes(`${toRelativePath(absoluteRoot, filePath)}:${registration.line}`))) {
        unresolved.add(`${toRelativePath(absoluteRoot, filePath)}:${registration.line}: router route is not mounted`);
      }
    }
  }

  return {
    routes: [...routes.values()].map((route) => ({
      ...route,
      sources: route.sources.sort(),
      aliases: route.aliases.sort(),
    })).sort((left, right) => `${left.method} ${left.path}`.localeCompare(`${right.method} ${right.path}`)),
    unresolved: [...unresolved].sort(),
  };
}
