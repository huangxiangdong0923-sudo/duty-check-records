# 云同步设计（2026-09-21）

## 问题

主屏幕上的「App」和浏览器里的网页是两块独立的本地存储（iOS / Android 都是），老师在一处录入的数据在另一处看不到。跨设备更不可能共享。本地存储解决不了这个问题，必须有一份云端数据。

## 方案

不新增账号、不新增服务器：把记录写进老师已有的 GitHub 私有仓库。

| 项目 | 值 |
| --- | --- |
| 仓库 | `huangxiangdong0923-sudo/duty-check-data`（私有，仅本人可见） |
| 文件 | `records.json` |
| 接口 | GitHub Contents API（`GET` 读、`PUT` 写），Bearer token 直接来自浏览器 |
| 凭证 | fine-grained PAT，只授权这一个仓库的 Contents 读写 |

凭证存在本机 `localStorage`，每个设备、每个入口粘贴一次。令牌一旦失效，同步失败但本机数据不受影响。

## 数据格式

```json
{ "schemaVersion": 1, "updatedAt": "ISO 时间", "records": [], "deletedIds": [] }
```

- 两个校区的记录都放同一个文件，记录自带 `campus` 字段，页面按校区过滤
- `deletedIds` 是墓碑：删除过的记录 id，用来把删除同步到其它设备

## 合并规则

1. 先读云端，再和本机合并，合并结果要写回时先比较指纹，没变化就不提交
2. 同一个 `id` 两边都有 → 取 `updatedAt` 较新的
3. `deletedIds` 取并集，落在里面的 id 两侧都不保留
4. 写入时带上读到的 `sha`；返回 409/422 说明别人先写了，重新读取、重新合并、再写一次

## 触发点

打开页面、切回页面、联网恢复、保存记录、删除记录、粘贴令牌、手动点「立即同步」。手动点击时如果已有同步在跑，等它结束后再同步一次，避免点击没反应。

## 关键坑

Service Worker 的 `fetch` 处理器会拦截**跨域**请求。api.github.com 的响应一旦被写进站点缓存，后续读到的就是旧 `sha`，每次上传都被 GitHub 判定为冲突。所以 Service Worker 必须放行所有非本站请求（`new URL(request.url).origin !== self.location.origin` 直接 return），并在测试里锁住这个顺序。
