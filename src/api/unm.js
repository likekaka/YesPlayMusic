// 网页端灰色歌曲替换：GD Studio 多音源解析 API + 酷我公开接口
// 文档/致谢：https://music.gdstudio.xyz（音乐数据来源于各平台公开接口）
// 通过 vercel.json / devServer proxy 同源代理 /unm /kuwo-search /kuwo-url，规避 CORS
export function getUnmUrl(id, br = '320') {
  return fetch(`/unm/api.php?types=url&source=netease&id=${id}&br=${br}`).then(
    response => response.json()
  );
}

// ---- 换源结果缓存 ----
// GD Studio 限频 5min/50 次，且播放器会预取下一首；
// 成功结果缓存 30min（直链带时效签名不能久存），失败负缓存 10min 防反复撞墙
const CACHE_PREFIX = 'unm_cache:';
const TTL_OK = 30 * 60 * 1000;
const TTL_FAIL = 10 * 60 * 1000;

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { url, exp } = JSON.parse(raw);
    if (Date.now() > exp) return null;
    return url; // '' 表示负缓存
  } catch {
    return null;
  }
}

function writeCache(key, url, ok) {
  try {
    localStorage.setItem(
      CACHE_PREFIX + key,
      JSON.stringify({
        url: url ?? '',
        exp: Date.now() + (ok ? TTL_OK : TTL_FAIL),
      })
    );
  } catch {
    /* localStorage 满了就算了 */
  }
}

export function clearUnmCache(trackId) {
  // trackId 可能出现在多个 br 的 key 里，前缀没法精确删，遍历一次
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(CACHE_PREFIX + trackId + ':')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

// ---- 酷我换源（GD Studio 无源时的 fallback）----

// search.kuwo.cn 返回单引号伪 JSON，正则提取需要的字段
function parseKuwoSearch(text) {
  const results = [];
  const blocks = text.split("{'").slice(1);
  for (const block of blocks) {
    const rid = block.match(/'DC_TARGETID':'(\d+)'/);
    const name = block.match(/'NAME':'([^']*)'/);
    const artist = block.match(/'ARTIST':'([^']*)'/);
    if (rid && name) {
      results.push({
        rid: rid[1],
        name: name[1].replace(/&nbsp;/g, ' ').trim(),
        artist: artist ? artist[1].replace(/&nbsp;/g, ' ').trim() : '',
      });
    }
  }
  return results;
}

export function searchKuwo(keyword) {
  const query = `all=${encodeURIComponent(
    keyword
  )}&ft=music&itemset=web_2013&client=kt&pn=0&rn=5&rformat=json&encoding=utf8`;
  return fetch(`/kuwo-search/r.s?${query}`)
    .then(response => response.text())
    .then(parseKuwoSearch);
}

export function getKuwoUrl(rid) {
  return fetch(
    `/kuwo-url/anti.s?type=convert_url3&rid=MUSIC_${rid}&format=mp3&br=320kmp3`
  ).then(response => response.json());
}

// 过滤伴奏/试听等变体，按歌名+歌手匹配最接近的一条
function pickKuwoMatch(hits, track) {
  const wantName = track.name.trim();
  const wantArtist = track.ar?.[0]?.name?.trim() ?? '';
  const skipPattern = /伴奏|ktv|纯音乐|inst\.?|demo|live版/i;
  return (
    hits.find(h => h.name === wantName && h.artist.includes(wantArtist)) ??
    hits.find(h => h.name === wantName && !skipPattern.test(h.name)) ??
    hits.find(h => h.name.includes(wantName) && !skipPattern.test(h.name)) ??
    null
  );
}

// 组合：搜歌名 → 匹配 → 取链
export async function resolveKuwoUrl(track) {
  const keyword = `${track.name} ${track.ar?.[0]?.name ?? ''}`.trim();
  const hits = await searchKuwo(keyword);
  if (!hits.length) return null;
  const match = pickKuwoMatch(hits, track);
  if (!match) return null;
  const result = await getKuwoUrl(match.rid);
  if (result?.code === 200 && result?.url) return result.url;
  return null;
}

// 网页端换源总入口：缓存 → GD Studio → 酷我
// 返回直链；全部失败返回 null（调用方回退 outer/url）
export async function resolveWebSource(track, br = '320') {
  const key = `${track.id}:${br}`;
  const cached = readCache(key);
  if (cached !== null) return cached || null;

  const gd = await getUnmUrl(track.id, br).catch(() => null);
  if (gd && gd.br > 0 && gd.url) {
    writeCache(key, gd.url, true);
    return gd.url;
  }

  const kuwoUrl = await resolveKuwoUrl(track).catch(() => null);
  if (kuwoUrl) {
    writeCache(key, kuwoUrl, true);
    return kuwoUrl;
  }

  writeCache(key, '', false);
  return null;
}
