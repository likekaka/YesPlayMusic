// 网页端灰色歌曲替换：GD Studio 多音源解析 API + 酷我公开接口
// 文档/致谢：https://music.gdstudio.xyz（音乐数据来源于各平台公开接口）
// 通过 vercel.json / devServer proxy 同源代理 /unm /kuwo-search /kuwo-url，规避 CORS
export function getUnmUrl(id, br = '320') {
  return fetch(`/unm/api.php?types=url&source=netease&id=${id}&br=${br}`).then(
    response => response.json()
  );
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
