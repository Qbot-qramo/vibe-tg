# 上流プロジェクトとライセンス

このスターターのLOGOインタプリタは、[oliverius/logo](https://github.com/oliverius/logo) を基にしています。

- 上流リポジトリ：<https://github.com/oliverius/logo>
- 取得した上流コミット：`53c2e88`（2025-05-10）
- 上流著作権表示：`Copyright (c) 2025 Oliver`
- ライセンス：MIT License（全文は同梱の `LICENSE`）

上流由来の主なファイルは `js/logo.js`、`js/logo.i18n.js`、`test/` と画像資産です。上流の著作権表示およびMITライセンス通知を同梱し、上流由来コードの複製・配布でも維持してください。`css/logo.css` は元の表示を土台に、このスターター用にレスポンシブ調整を加えています。

`index.html`、`js/site.js`、このREADMEおよび本ファイルは、GitHub Pagesで使いやすくするために追加したスターター用ファイルです。

## 上流コードへの変更

`js/logo.js` には次の変更を加えています。

- 式の中で括弧 `( )` を使えるようにした（ブロックで組んだ入れ子の計算をテキストで表すため）。
- 条件が偽の `IF` を読み飛ばすとき、ブロック内の入れ子の `[ ]` を正しく数えるようにした（以前は最初の `]` で止まっていた）。

## Scratch Blocks

ブロックエディター（`js/blocks.js`）は [scratchfoundation/scratch-blocks](https://github.com/scratchfoundation/scratch-blocks)（Apache License 2.0、Blocklyを含む）を利用しています。リポジトリには同梱せず、実行時にjsDelivrから固定バージョン（`js/blocks.js` の `SCRATCH_BLOCKS_VERSION`）を読み込みます。Scratchの名称・ロゴ等はScratch Foundationの商標であり、本プロジェクトはScratch Foundationとは関係ありません。
