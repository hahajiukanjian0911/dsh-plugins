import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open, mkdir, writeFile, readFile } from 'node:fs/promises';

const app = process.env.DSH_APP || '/Applications/DeepSeek Harness.app';
const file = await open(app + '/Contents/Resources/app.asar', 'r');
try {
  const prefix = Buffer.alloc(16);
  await file.read(prefix, 0, 16, 0);
  const buffer = Buffer.alloc(prefix.readUInt32LE(12));
  await file.read(buffer, 0, buffer.length, 16);
  const tree = JSON.parse(buffer.toString()).files;
  const base = 8 + prefix.readUInt32LE(4);
  async function read(path) {
    const parts = path.split('/');
    let node = { files: tree };
    for (const part of parts) node = node.files[part];
    const contents = Buffer.alloc(node.size);
    await file.read(contents, 0, contents.length, base + Number(node.offset));
    return contents.toString();
  }
  const root = 'dsh/node_modules/@deepseek-ai/';
  const sidebar = await read(root + 'dsh-client-ui-sidebar/lib/client.js');
  const workspace = await read(root + 'dsh-client-ui-workspace/lib/client.js');
  const session = await read(root + 'dsh-client-ui-session/lib/client.js');
  const conversation = await read(root + 'dsh-client-ui-conversation/lib/client.js');
  const settingsGeneral = await read(root + 'dsh-client-ui-settings-general/lib/client.js');
  const renderer = await read(root + 'dsh-client-ui-renderer/lib/client.js');
  const assets = tree.dsh.files.node_modules.files['@deepseek-ai'].files['dsh-web-frontend']
    .files.dist.files.assets.files;
  const asset = Object.keys(assets).find((name) => /^index-.*\.js$/.test(name));
  const frontend = await read(root + 'dsh-web-frontend/dist/assets/' + asset);
  const iconsSource=await readFile('src/native/Sidebar.jsx','utf8');
  const nativeIcons=[...new Set([...iconsSource.matchAll(/'(Icon\w+Regular)'/g)].map(m=>m[1])),'IconPanelLeftOutlineRegular'];
  const updateStart = settingsGeneral.indexOf('function DesktopUpdateIndicator(');
  const updateButton = settingsGeneral.slice(updateStart, settingsGeneral.indexOf('function DesktopUpdateBadge(', updateStart));
  const connectionName = frontend.match(/ConnectionIndicator:([\w$]+)/)?.[1];
  const connectionStart = frontend.indexOf('function ' + connectionName + '(');
  const connectionIndicator = frontend.slice(connectionStart, connectionStart + 1500);
  const tooltipName = frontend.match(/Tooltip:([\w$]+)/)?.[1];
  const tooltipStart = frontend.indexOf('function ' + tooltipName + '(');
  const tooltip = frontend.slice(tooltipStart, tooltipStart + 4500);
  const manifest = JSON.parse(await read(root + 'dsh-client-ui-workspace/package.json'));
  const checks = {
    version: manifest.version === '0.2.2-rc.1',
    sidebarSlot: sidebar.includes('name: "sidebar.workspaces"') || sidebar.includes('"sidebar.workspaces": {'),
    priorityShadowing: frontend.includes('register at a different priority to shadow it (lowest renders)'),
    entryInspection: frontend.includes('entriesOfSlot(') && frontend.includes('entries('),
    nativeCommands: workspace.includes('workspaceShortcuts: shortcutControls.state')
      && workspace.includes('closeAddWorkspace: shortcutControls.closeAdd'),
    navigation: workspace.includes('openSession(target)') && workspace.includes('startSession(workspaceId, options)'),
    inlineRename: workspace.includes('sessions.using(sessionId, { source: "workspaceOperation" }')
      && workspace.includes('reference.binding.session.rename(title)'),
    directoryPicker: workspace.includes('async pickDirectory()') && workspace.includes('createWorkspace({ path })'),
    statusSource: session.includes('sessionStatus = {') && session.includes('pendingInteraction:'),
    sessionScopedComposerNotice: /"conversation.input.dock":\s*\{\s*kind: "list",\s*scope: "session"/.test(conversation),
    composerNoticeBeforeInput: /renderSlot\("conversation.input.dock", zone\),\s*inputBar/.test(conversation),
    sessionIdProp: session.includes('props: { sessionId: binding.sessionId }'),
    nativeUpdateButton: updateButton.includes('"aria-disabled": busy') && updateButton.includes('"aria-label": label')
      && updateButton.includes('if (!busy) onOpen();'),
    connectionStatusGuard: connectionStart >= 0 && connectionIndicator.includes('"data-phase"'),
    nativeTooltipKeepsDirectTrigger: tooltipStart >= 0 && tooltip.includes('cloneElement('),
    shellAnchors: renderer.includes('"data-slot": slotKey')
      && sidebar.includes('"data-window-drag": true') && sidebar.includes('"data-sidebar-toggle": true'),
    nativePanelMarkup: sidebar.includes('"nav", {') && sidebar.includes('"aria-label": label')
      && sidebar.includes('"aria-hidden": "true"'),
    settingsSectionSlot: /"settings.section":\s*\{\s*kind: "list",\s*scope: "root"/.test(settingsGeneral),
    settingsSectionIconSlot: /"settings.section.icon":\s*\{\s*kind: "list"/.test(settingsGeneral),
    settingsNavigationLabels: settingsGeneral.includes('ctx.slots.entries("settings.section")') && settingsGeneral.includes('resolveSlotLabel'),
    nativeSettingsControls: settingsGeneral.includes('_deepseek_ai_dsh_client_ui_primitives.Switch,') && settingsGeneral.includes('_deepseek_ai_dsh_client_ui_primitives.Button,') && frontend.includes('"@deepseek-ai/dsh-client-ui-primitives":'),
    nativeSidebarIcons: nativeIcons.every(name=>frontend.includes(name+':')),
    nativeSidebarControls: ['AnimatedRows','Button','HoverCard','HoverCardGroup','Input','Menu','Modal','StateDot','Tooltip','useRowDragPreview']
      .every(name=>frontend.includes(name+':')),
    nativeIconProps: frontend.includes('return({size:l=r,className:u})=>') && frontend.includes('"data-icon":s'),
    sharedReactJsxRuntime: frontend.includes('\"react/jsx-runtime\":'),
    sharedReactDom: frontend.includes('"react-dom":') && frontend.includes('"react-dom/client":')
      && frontend.includes('staticModules:'),
  };
  assert.ok(Object.values(checks).every(Boolean), JSON.stringify(checks));
  const report = { app, version: manifest.version, scope: 'Static installed-host contract inspection', checks,
    nativeIcons,
    workspaceClientSha256: createHash('sha256').update(workspace).digest('hex'),
    conversationClientSha256: createHash('sha256').update(conversation).digest('hex'),
    settingsGeneralClientSha256: createHash('sha256').update(settingsGeneral).digest('hex') };
  await mkdir('outputs', { recursive: true });
  await writeFile('outputs/host-contract.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await file.close(); }
