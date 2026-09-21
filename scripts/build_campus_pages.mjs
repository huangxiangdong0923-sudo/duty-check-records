// 根据 js/campuses.js 生成各校区的入口页与 manifest。
// 东校区用根目录的 index.html；其他校区生成到 campus/<id>/。
// 用法：node scripts/build_campus_pages.mjs

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CAMPUSES, DEFAULT_CAMPUS } from '../js/campuses.js';

export function campusDisplayName(campus) {
  return `值日检查记录（${campus.label}）`;
}

export function renderCampusHtml(template, campus) {
  const name = campusDisplayName(campus);
  return template
    .replace(/href="\.\//g, 'href="../../')
    .replace(/src="\.\//g, 'src="../../')
    .replace(/href="\.\.\/\.\.\/manifest\.webmanifest"/, 'href="./manifest.webmanifest"')
    .replace(/<title>[^<]*<\/title>/, `<title>${name}</title>`)
    .replace(/(<h1 id="app-title">)[^<]*(<\/h1>)/, `$1${name}$2`);
}

export function renderCampusManifest(base, campus) {
  return {
    ...base,
    name: campusDisplayName(campus),
    short_name: campus.shortLabel,
    icons: base.icons.map((icon) => ({ ...icon, src: `../../${String(icon.src).replace(/^\.\//, '')}` })),
  };
}

export function secondaryCampuses() {
  return CAMPUSES.filter((campus) => campus.id !== DEFAULT_CAMPUS.id);
}

export async function buildCampusPages(rootDir) {
  const template = await readFile(path.join(rootDir, 'index.html'), 'utf8');
  const baseManifest = JSON.parse(await readFile(path.join(rootDir, 'manifest.webmanifest'), 'utf8'));
  const written = [];
  for (const campus of secondaryCampuses()) {
    const targetDir = path.join(rootDir, 'campus', campus.id);
    await mkdir(targetDir, { recursive: true });
    await writeFile(path.join(targetDir, 'index.html'), renderCampusHtml(template, campus));
    await writeFile(
      path.join(targetDir, 'manifest.webmanifest'),
      `${JSON.stringify(renderCampusManifest(baseManifest, campus), null, 2)}\n`,
    );
    written.push(path.relative(rootDir, targetDir));
  }
  return written;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const rootDir = fileURLToPath(new URL('../', import.meta.url));
  const written = await buildCampusPages(rootDir);
  console.log(written.length ? `已生成：${written.join('、')}` : '没有需要生成的校区页面');
}
