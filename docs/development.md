# 開発ガイド

## ビルドとチェック

Node.js **22.14.0**（`.node-version`）を使用します。リポジトリのルートで以下を実行します。

```sh
npm ci
npm run check
npm run package
```

生成される `visual-japanese-spacing-0.0.1.vsix` を VS Code にインストールできます。

`npm run check` は、書式、TypeScript の型チェック、ESLint、テストを実行します。書式の修正には `npm run format` を使用します。CI でも同じチェックとパッケージ作成を実行しますが、公開は行いません。

テストは TypeScript の `import` と Mocha の `describe` / `it` で記述し、`@vscode/test-electron` から実際の Extension Development Host で実行します。初回は VS Code 1.100.0 をダウンロードします。画面のない Linux では `xvfb-run -a npm run check` を使用します。既存の VS Code で確認する場合は、実行ファイルの絶対パスを環境変数 `VSCODE_EXECUTABLE_PATH` に指定できます。

テスト専用のプロファイルと 2 フォルダーのワークスペースを一時作成し、終了後に削除します。通常利用する VS Code の設定・文書は変更しません。`src/test` は `out-test` に分離してコンパイルし、テストと開発依存は VSIX に含めません。

## デバッグ

1. VS Code でリポジトリのフォルダーを開きます。
2. **F5** で **Run Visual Japanese Spacing** を起動します。
3. Extension Development Host で `.md` または `.txt` を開きます。

表示に必要な設定は [README](../README.md) に記載しています。コードの変更後はデバッグを再起動します。

## 実装

VS Code の公開 [Inlay Hints API](https://code.visualstudio.com/api/references/vscode-api#InlayHintsProvider) を使用しています。

- `src/boundaries.ts`: Unicode に基づく文字判定と UTF-16 の境界位置の算出
- `src/spacingHints.ts`: VS Code が要求した範囲とその前後の読み取り、インレイヒントの作成
- `src/spacingController.ts`: インレイヒント登録、設定変更の通知、コマンド、リソースの解放
- `src/extension.ts`: 拡張機能の起動処理

## 検証

### 自動チェック（0.0.1・2026-10-11）

Node.js 22.14.0 と Linux x64 の VS Code 1.142.0-insider で、クリーンインストール、書式、厳格な TypeScript 型チェック、ESLint、VSIX の作成と **26 件のテスト**を確認しています。

- Unicode の文字境界、UTF-16 の位置、結合文字、部分的な要求範囲、キャンセル。
- 文書ごとの言語・数字設定、明示的な Enable/Disable、設定の適用範囲、設定更新の順序と失敗時の回復。
- インレイヒントの更新・破棄と、実際の VS Code API を使った起動処理。制御処理の単体テストでは Sinon で API の呼び出しを検査します。
- 実際の設定 API によるユーザー・ワークスペース・フォルダーの更新、複数フォルダーの分離、アクティブなエディターがない場合のワークスペース設定。

ビルド時に古い出力を削除し、VSIX のマニフェストとファイル一覧で Markdown プレビューの機能・アセットを含まないことも確認しています。自動テストではテスト用文書の編集と拡張機能自身の設定更新を検証します。設定は各テスト後に復元し、通常利用するプロファイルや `editor.inlayHints.*` は変更しません。ネイティブ描画、クリップボード、元に戻す操作は、別途エディターで確認します。

### エディターでの確認

Linux x64 の VS Code **1.142.0-insider** の独立したプロファイルで、[README](../README.md) の必要な設定を適用し、同じ実装の試用パッケージを確認済みです。

- Markdown と Python のソースエディターで余白が表示され、狭いウィンドウ内で折り返されます。
- Disable で余白が消え、Enable で再表示されます。
- Open Settings で 3 つの拡張機能設定と有効状態を確認できます。
- Python のテキストをコピーし、新しいエディターへ貼り付けて保存した結果は、元ファイルとバイト単位で一致します。検証用ワークスペースの Git 作業ツリーも変更されません。

試用 VSIX の SHA-256 は `849e5f2c756079f482a2756b9a3aeaf741a9305e0dec6d1b38eedfdbdbdfb63a` です。開発中の仮バージョン番号を 0.0.1 に統一しましたが、**0.0.1 の GUI テストは再実行していません**。実行時の JavaScript 4 ファイルは、GUI 検証済み実装とバイト単位で一致しています。

それ以前にも、変更していないインレイヒントの生成・制御処理について、同じ Linux 版 VS Code で、余白を含む折り返し（従来の装飾方式のようなはみ出しがないこと）、対象言語への Python の追加、Enable/Disable、文字境界への入力と元に戻す操作、コピー内容の一致を確認しています。元ファイルのハッシュと Git 作業ツリーに変更はありません。上記の試用パッケージでは簡素化した起動処理も確認済みです。

### 制限と未検証の範囲

表示幅、必要な設定とほかのインレイヒントへの影響は [README](../README.md#対象と制限) に記載しています。`maximumLength: 0` で行あたりのラベル長の制限を外しても、VS Code 全体の表示数の上限は残ります。

最低対応バージョンは VS Code 1.100.0 の公開 API と描画処理のソースに基づきます。**macOS、Windows、最古の対応バージョン、アクセシビリティ、IME 入力は個別に検証していません。**

実行時の外部依存、テレメトリー、通信、文書への編集、クリップボードの横取りはありません。この記録はセキュリティ監査ではなく、Marketplace への公開も行っていません。

[変更履歴](../CHANGELOG.md)
