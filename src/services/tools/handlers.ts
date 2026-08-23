import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import RNFS from 'react-native-fs';
import { ToolCall, ToolResult } from './types';
import type { RagSearchResult } from '../rag';
import logger from '../../utils/logger';

const ROOT = RNFS.DocumentDirectoryPath + '/projects/';
const LOG_PATH = ROOT + '../logs/actions.json';
const STATUS_PATH = ROOT + '../memory/task_status.json';

// ---------- LOGGER + RESTRICTION ----------
async function addLog(tool: string, data: any) {
  try {
    await RNFS.mkdir(ROOT + '../logs').catch(()=>{});
    const old = await RNFS.readFile(LOG_PATH,'utf8').catch(()=> '[]');
    const arr = JSON.parse(old); arr.push({time:Date.now(), tool, data});
    await RNFS.writeFile(LOG_PATH, JSON.stringify(arr.slice(-500)), 'utf8');
  } catch {}
}

const RED = ['handlers.ts','handle.ts','main.dart','pubspec.yaml','auth_guard','executeToolCall','dispatchTool'];
const YELLOW = ['screens','download','github','export_apk','clone_repo','evolution','ghost','schedule'];
function checkAccess(pathOrTool: string): {allowed:boolean, needPin:boolean} {
  const p = pathOrTool.toLowerCase();
  if (RED.some(r => p.includes(r))) return {allowed:false, needPin:false};
  if (YELLOW.some(y => p.includes(y))) return {allowed:true, needPin:true};
  return {allowed:true, needPin:false};
}

// ---------- DUAL HEARTBEAT ----------
let workerTimer: any = null;
let bossTimer: any = null;
let lastBossAsk = 0;

export function startHeartbeats(sendToChat: (msg:string)=>void) {
  // HEARTBEAT 1: Worker - every 30 sec, silent
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = setInterval(async () => {
    try {
      const statusRaw = await RNFS.readFile(STATUS_PATH,'utf8').catch(()=> '{}');
      const status = JSON.parse(statusRaw);
      if (status.running) {
        // auto-increase progress simulation
        status.progress = Math.min(95, (status.progress||0)+5);
        await RNFS.writeFile(STATUS_PATH, JSON.stringify(status), 'utf8');
      }
    } catch {}
  }, 30000);

  // HEARTBEAT 2: Boss checker - every 10 min, proactive
  if (bossTimer) clearInterval(bossTimer);
  bossTimer = setInterval(async () => {
    try {
      const statusRaw = await RNFS.readFile(STATUS_PATH,'utf8').catch(()=> '{}');
      const status = JSON.parse(statusRaw);
      if (status.running) {
        sendToChat(`Boss, quick update - ${status.task} is ${status.progress}% done. Still working on it... 🛠️`);
      } else {
        const now = Date.now();
        if (now - lastBossAsk > 9*60*1000) {
          sendToChat(`Boss is there something I can do for you? 👀`);
          lastBossAsk = now;
        }
      }
    } catch {}
  }, 10*60*1000); // 10 mins

  logger.info('[Heartbeat] Both heartbeats started');
}

export function handleBossReply(text: string, sendToChat: (msg:string)=>void) {
  const t = text.toLowerCase().trim();
  if (['no','nahi','nope','not now','later'].some(w=>t.includes(w))) {
    sendToChat(`Okay boss, I will check with you after 10 mins again 🙏`);
    lastBossAsk = Date.now(); // reset timer
    return true;
  }
  return false;
}

// ---------- ORIGINAL HELPERS ----------
function makeResult(call: ToolCall, start: number, opts: { content: string; error?: string }): ToolResult {
  return { toolCallId: call.id, name: call.name, content: opts.content, error: opts.error, durationMs: Date.now() - start };
}
function requireString(call: ToolCall, param: string): string | null {
  const val = call.arguments[param];
  return (val && typeof val === 'string' && val.trim())? val.trim() : null;
}

export async function executeToolCall(call: ToolCall): Promise<ToolResult> {
  const start = Date.now();
  try {
    const content = await dispatchTool(call);
    return makeResult(call, start, { content });
  } catch (error: any) {
    logger.error(`[Tools] Error executing ${call.name}:`, error);
    return makeResult(call, start, { content: '', error: error.message || 'Tool execution failed' });
  }
}

// ---------- DISPATCHER WITH 50 TOOLS ----------
async function dispatchTool(call: ToolCall): Promise<string> {
  const args = call.arguments as any;

  // Restriction check for all file tools
  const pathArg = args.path || args.name || args.url || call.name;
  const access = checkAccess(pathArg);
  if (!access.allowed) throw new Error(`RED FILE BLOCKED: ${pathArg} - Cannot touch core file`);
  if (access.needPin &&!args.pin_verified) return `NEED_PIN: This action needs PIN. Action: ${call.name} ${pathArg}`;

  switch (call.name) {
    // --- YOUR EXISTING 6 ---
    case 'web_search': {
      const q = requireString(call, 'query');
      if (!q) throw new Error('Missing required parameter: query');
      return handleWebSearch(q);
    }
    case 'calculator': return handleCalculator(args