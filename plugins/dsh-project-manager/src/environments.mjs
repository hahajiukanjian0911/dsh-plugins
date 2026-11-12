import { randomUUID } from "node:crypto";
export function environmentAddress(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("请输入完整的 DSH 访问地址。");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("环境地址必须是 HTTP 或 HTTPS 地址。");
  const token = url.searchParams.get("token");
  url.search = "";
  url.hash = "";
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return { url: url.href, token };
}
export async function loginEnvironment(input, fetcher = fetch) {
  const { url, token } = environmentAddress(input);
  if (!token) throw new Error("首次连接请填写带 token 的 DSH 启动地址。");
  const login = new URL(url);
  login.searchParams.set("token", token);
  let response;
  try {
    response = await fetcher(login, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new Error("无法连接该环境，请检查地址。");
  }
  const cookies =
    response.headers.getSetCookie?.() ??
    [response.headers.get("set-cookie")].filter(Boolean);
  const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
  if (response.status !== 302 || !cookie)
    throw new Error("环境授权失败，请使用该 DSH 当前的启动地址。");
  return { url, cookie, token };
}
export async function remoteCall(
  environment,
  grant,
  method,
  request = {},
  fetcher = fetch,
) {
  if (!grant?.cookie) throw new Error("环境授权已失效，请重新连接。");
  const rpcId = randomUUID();
  let response;
  try {
    response = await fetcher(
      new URL(`api/projectManager/${method}`, environment.url),
      {
        method: "POST",
        headers: { "content-type": "application/json", cookie: grant.cookie },
        body: JSON.stringify({
          type: "client-request",
          rpcId,
          method: `projectManager/${method}`,
          payload: { args: { request } },
        }),
        signal: AbortSignal.timeout(method === "local" ? 3500 : 10000),
      },
    );
  } catch {
    throw new Error("环境离线或连接超时。");
  }
  if (response.status === 401 || response.status === 403)
    throw new Error("环境授权已失效，请重新连接。");
  if (!response.ok)
    throw new Error("该环境未能响应，请确认已安装项目管理插件。");
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("该环境未返回有效的 DSH 响应。");
  }
  if (body.rpcId !== rpcId || !body.result)
    throw new Error("环境响应与请求不匹配。");
  if (!body.result.ok)
    throw new Error(body.result.error?.message || "远程操作失败。");
  return body.result.value;
}
