type DingtalkConfig = {
  clientId: string;
  clientSecret: string;
  agentId: string;
  apiBaseUrl: string;
};

type DingtalkTextMessage = {
  userId: string;
  content: string;
};

type DingtalkTokenResponse = {
  errcode?: number;
  errmsg?: string;
  access_token?: string;
  expires_in?: number;
};

type DingtalkSendResponse = {
  errcode?: number;
  errmsg?: string;
  task_id?: number;
  request_id?: string;
};

const DEFAULT_DINGTALK_API_BASE_URL = "https://oapi.dingtalk.com";

function readEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return "";
}

async function parseDingtalkResponse<T>(response: Response) {
  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(`钉钉接口请求失败：HTTP ${response.status}`);
  }
  return data;
}

export function loadDingtalkConfigFromEnv() {
  const config = {
    clientId: readEnv("DINGTALK_CLIENT_ID", "DINGTALK_APP_KEY"),
    clientSecret: readEnv("DINGTALK_CLIENT_SECRET", "DINGTALK_APP_SECRET"),
    agentId: readEnv("DINGTALK_AGENT_ID"),
    apiBaseUrl: readEnv("DINGTALK_API_BASE_URL") || DEFAULT_DINGTALK_API_BASE_URL,
  };
  const missing = [
    ["DINGTALK_CLIENT_ID", config.clientId],
    ["DINGTALK_CLIENT_SECRET", config.clientSecret],
    ["DINGTALK_AGENT_ID", config.agentId],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  return { config, missing };
}

export async function getDingtalkAccessToken(config: DingtalkConfig) {
  const url = new URL("/gettoken", config.apiBaseUrl);
  url.searchParams.set("appkey", config.clientId);
  url.searchParams.set("appsecret", config.clientSecret);

  const data = await parseDingtalkResponse<DingtalkTokenResponse>(await fetch(url));
  if (data.errcode !== 0 || !data.access_token) {
    throw new Error(`获取钉钉 access_token 失败：${data.errmsg || "未知错误"}`);
  }

  return data.access_token;
}

export async function sendDingtalkWorkNotice(
  config: DingtalkConfig,
  accessToken: string,
  message: DingtalkTextMessage
) {
  const agentId = Number(config.agentId);
  if (!Number.isSafeInteger(agentId)) {
    throw new Error("DINGTALK_AGENT_ID 必须是数字");
  }

  const url = new URL("/topapi/message/corpconversation/asyncsend_v2", config.apiBaseUrl);
  url.searchParams.set("access_token", accessToken);

  const data = await parseDingtalkResponse<DingtalkSendResponse>(
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: agentId,
        userid_list: message.userId,
        msg: {
          msgtype: "text",
          text: {
            content: message.content,
          },
        },
      }),
    })
  );

  if (data.errcode !== 0) {
    throw new Error(`发送钉钉工作通知失败：${data.errmsg || "未知错误"}`);
  }

  return data;
}

