/*
 * MCP server 的生命週期:啟動 Streamable HTTP transport、探索檔的健康檢查與
 * 覆蓋判斷、停用時的清理(design.md 決策 1、3、4、9)。兩個工具的 handler
 * 直接呼叫既有的公開方法與純函式,這裡不重算業務邏輯。
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as vscode from 'vscode';
import { t } from '../shared/i18n';
import { buildAgentWalkList } from './agentWalkList';
import { computeDiscoveryFilePath, type McpDiscoveryInfo } from './mcpDiscovery';
import type { WalkPlayerViewProvider } from './viewProvider';
import { listWalkFiles } from './walkLoader';

const HEALTH_CHECK_TIMEOUT_MS = 300;

let httpServer: Server | undefined;
let ownDiscoveryFilePath: string | undefined;

async function isServerAlive(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function readDiscoveryInfo(discoveryFilePath: string): Promise<McpDiscoveryInfo | null> {
  try {
    const content = await readFile(discoveryFilePath, 'utf-8');
    return JSON.parse(content) as McpDiscoveryInfo;
  } catch {
    return null;
  }
}

function createMcpServer(provider: WalkPlayerViewProvider, workspaceRoot: string): McpServer {
  const server = new McpServer({ name: 'codewalk-reader', version: '1.0.0' });

  server.registerTool(
    'codewalk_current_step',
    {
      title: 'CodeWalk current step',
      description: '取得讀者目前在 CodeWalk 面板瀏覽到哪一份導讀、第幾步(唯讀,不改變面板狀態)。',
    },
    async () => {
      const snapshot = provider.getCurrentStepSnapshot();
      return { content: [{ type: 'text', text: JSON.stringify(snapshot) }] };
    },
  );

  server.registerTool(
    'codewalk_list_walks',
    {
      title: 'CodeWalk list walks',
      description: '列出目前 workspace 下可播放的導讀(路徑與標題)。',
    },
    async () => {
      const files = await listWalkFiles(workspaceRoot);
      const result = buildAgentWalkList(files, workspaceRoot);
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );

  return server;
}

/**
 * 啟動 MCP server。呼叫端(`extension.ts`)必須以 fire-and-forget 呼叫,啟動
 * 失敗不該擋住 extension 的其他功能(design.md 決策 9)。
 *
 * @remarks
 * 先對探索檔記錄的 port(若存在)做一次 health check——活著就判定另一個視窗
 * 已在服務這個 workspace,不啟動也不覆蓋,只通知讀者一次;沒反應則視為殭屍
 * 記錄或首次啟動,正常覆蓋(design.md 決策 4)。
 */
export async function startMcpServer(provider: WalkPlayerViewProvider, workspaceRoot: string): Promise<void> {
  const discoveryFilePath = computeDiscoveryFilePath(tmpdir(), workspaceRoot);
  const existing = await readDiscoveryInfo(discoveryFilePath);
  if (existing && (await isServerAlive(existing.port))) {
    vscode.window.showInformationMessage(t('mcp.anotherWindowServing'));
    return;
  }

  const mcpServer = createMcpServer(provider, workspaceRoot);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
  await mcpServer.connect(transport);

  const server = createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200).end('ok');
      return;
    }
    void transport.handleRequest(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  await mkdir(dirname(discoveryFilePath), { recursive: true });
  const info: McpDiscoveryInfo = { port, pid: process.pid };
  await writeFile(discoveryFilePath, JSON.stringify(info));

  httpServer = server;
  ownDiscoveryFilePath = discoveryFilePath;
}

/** 關閉 HTTP server 並盡力刪除自己寫入的探索檔(design.md 決策 9)。 */
export async function stopMcpServer(): Promise<void> {
  if (httpServer) {
    const server = httpServer;
    httpServer = undefined;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (ownDiscoveryFilePath) {
    const path = ownDiscoveryFilePath;
    ownDiscoveryFilePath = undefined;
    try {
      await rm(path, { force: true });
    } catch {
      // best-effort——探索檔清理失敗不該讓 extension 停用卡住(design.md 決策 9)
    }
  }
}
