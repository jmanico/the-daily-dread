import { API } from 'typescript/unstable/sync';
import * as ast from 'typescript/unstable/ast';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runtimePolicy } from './runtime-policy.mjs';

const forbiddenNames = new Set(['eval', 'Function', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Worker', 'require']);
const forbiddenProperties = new Set(['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'dangerouslySetInnerHTML', 'execScript', 'constructor']);

/** @typedef {{file:string,line:number,rule:string}} Finding */

/** Uses the exact pinned TypeScript 7 API. Failures throw; no fallback regex parser.
 * @param {string} root
 * @param {Map<string,string[]>} [policy]
 * @returns {Promise<Finding[]>}
 */
export async function checkRuntime(root, policy = runtimePolicy) {
  /** @type {Finding[]} */
  const findings = [];
  /** @type {string[]} */
  const files = [];
  /** @param {string} directory */
  async function collect(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) throw new Error('Runtime source symlinks are not permitted');
      if (entry.isDirectory()) await collect(path);
      else if (/\.(?:[cm]?js|jsx|tsx?|mts|cts)$/.test(entry.name)) files.push(path);
    }
  }
  const top = await readdir(root);
  for (const directory of ['demo', 'src']) if (top.includes(directory)) await collect(join(root, directory));
  if (top.includes('scripts')) {
    const scripts = await readdir(join(root,'scripts'));
    for (const name of ['demo-server.mjs','serve-demo.mjs']) if (scripts.includes(name)) files.push(join(root,'scripts',name));
  }
  if (files.length === 0) throw new Error('No runtime sources found');
  const api = new API({ cwd: root });
  try {
    const snapshot = api.updateSnapshot({ openProjects: [join(root, 'jsconfig.json')] });
    try {
      const project = snapshot.getProject(join(root, 'jsconfig.json'));
      if (!project) throw new Error('Checked project unavailable');
      const checker = project.checker;
      for (const file of files) {
        const name = relative(root, file).split('\\').join('/');
        const source = project.program.getSourceFile(file);
        if (!source || !project.rootFiles.includes(file)) {
          findings.push({file:name,line:1,rule:'unchecked-runtime-file'});
          continue;
        }
        const permitted = policy.get(name);
        if (!permitted) findings.push({file:name,line:1,rule:'unreviewed-runtime-module'});
        if (project.program.getSyntacticDiagnostics(file).length > 0) {
          findings.push({file:name,line:1,rule:'invalid-runtime-syntax'});
          continue;
        }
        /** @param {import('typescript/unstable/ast').Node} node @param {string} rule */
        const report = (node, rule) => findings.push({file:name,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1,rule});
        // SEC-5: permit only the named import at the fixed JSON worker owner, not a global/browser Worker.
        const workerImports = new Set();
        /** @param {import('typescript/unstable/ast').Node} node */
        function visit(node) {
          if (ast.isImportDeclaration(node) || ast.isExportDeclaration(node)) {
            const specifier = node.moduleSpecifier;
            if (specifier && (!ast.isStringLiteral(specifier) || !permitted?.includes(specifier.text))) report(node,'unapproved-import');
            if (name === 'src/workers/json-tasks.js' && ast.isImportDeclaration(node) &&
              specifier && ast.isStringLiteral(specifier) && specifier.text === 'node:worker_threads') {
              const bindings = node.importClause?.namedBindings;
              if (bindings && ast.isNamedImports(bindings)) for (const binding of bindings.elements) {
                if (binding.propertyName?.text === 'Worker' && binding.name.text === 'ParserWorker') workerImports.add(binding.propertyName);
              }
            }
          }
          if (ast.isIdentifier(node) && forbiddenNames.has(node.text) && !workerImports.has(node)) report(node,'prohibited-runtime-capability');
          if (ast.isIdentifier(node) && forbiddenProperties.has(node.text)) report(node,'html-or-code-sink');
          if (ast.isElementAccessExpression(node)) {
            const argument = node.argumentExpression;
            if(ast.isIdentifier(node.expression) && node.expression.text==='process')report(node,'runtime-process-access');
            if (!ast.isStringLiteral(argument)) {
              if (ast.isIdentifier(node.expression) && ['window','globalThis','self','global','process'].includes(node.expression.text)) report(node,'computed-capability-access');
            }
            else if (forbiddenNames.has(argument.text) || forbiddenProperties.has(argument.text)) report(node,'prohibited-runtime-capability');
          }
          if (ast.isPropertyAccessExpression(node) && ast.isIdentifier(node.expression) && node.expression.text === 'process') {
            const call=node.parent;
            // SEC-8/REQ-PLATFORM-023: only direct lifecycle calls at this owner.
            // Environment, filesystem/stdio, dynamic properties and aliases stay forbidden.
            const lifecycle=name==='src/lifecycle/process-boundary.js' && ast.isCallExpression(call) && call.expression===node &&
              (['exit','listenerCount','hasUncaughtExceptionCaptureCallback'].includes(node.name.text) ||
                node.name.text==='on' && call.arguments[0] && ast.isStringLiteral(call.arguments[0]) &&
                ['SIGTERM','SIGINT','uncaughtException','unhandledRejection'].includes(call.arguments[0].text));
            if(!lifecycle && !(name === 'scripts/serve-demo.mjs' && ['on','exitCode'].includes(node.name.text))) report(node,'runtime-process-access');
          }
          if (ast.isCallExpression(node)) {
            if (node.expression.kind === ast.SyntaxKind.ImportKeyword) report(node,'dynamic-runtime-import');
            if (ast.isIdentifier(node.expression) && ['setTimeout','setInterval'].includes(node.expression.text) && node.arguments[0] && ast.isStringLiteral(node.arguments[0])) report(node,'string-timer');
            if (ast.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'forEach' && node.arguments.some(arg => (ast.isArrowFunction(arg) || ast.isFunctionExpression(arg)) && arg.modifiers?.some(modifier=>modifier.kind === ast.SyntaxKind.AsyncKeyword))) report(node,'async-for-each');
          }
          if (ast.isCatchClause(node) && node.block.statements.length === 0) report(node,'empty-catch');
          if (ast.isJsxSpreadAttribute(node)) report(node,'jsx-prop-spread');
          if (ast.isIfStatement(node) || ast.isConditionalExpression(node)) {
            const condition = ast.isIfStatement(node) ? node.expression : node.condition;
            const type = checker.getTypeAtLocation(condition);
            if (type && checker.getPropertyOfType(type,'then')) report(node,'promise-as-decision');
          }
          if (ast.isExpressionStatement(node) || ast.isVoidExpression(node)) {
            const type = checker.getTypeAtLocation(node.expression);
            if (!type) report(node,'unresolved-expression-type');
            else if (checker.getPropertyOfType(type,'then') || (type.isUnionType() && type.getTypes().some(member=>checker.getPropertyOfType(member,'then')))) report(node,'unowned-promise');
          }
          node.forEachChild(visit);
        }
        visit(source);
      }
      return findings;
    } finally { snapshot.dispose(); }
  } finally { api.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const findings = await checkRuntime(resolve('.'));
    for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.rule}`);
    if (findings.length) process.exitCode = 1;
    else console.log('Runtime import and security checks passed.');
  } catch {
    console.error('Runtime checks could not complete.');
    process.exitCode = 1;
  }
}
