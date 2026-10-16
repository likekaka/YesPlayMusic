// 网页端灰色歌曲替换：GD Studio 多音源解析 API
// 文档/致谢：https://music.gdstudio.xyz（音乐数据来源于各平台公开接口）
// 通过 vercel.json / devServer proxy 同源代理 /unm 访问，规避 CORS
export function getUnmUrl(id, br = '320') {
  return fetch(`/unm/api.php?types=url&source=netease&id=${id}&br=${br}`).then(
    response => response.json()
  );
}
