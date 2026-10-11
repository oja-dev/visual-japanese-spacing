# Visual Japanese Spacing

日本語と ASCII 英数字の間に、読みやすい余白を表示する VS Code 拡張機能です。

`日本語VSCodeで文章を書く` → 表示上は `日本語 VSCode で文章を書く`

余白はインレイヒントとして表示します。ファイルの内容やコピーしたテキスト、Git の差分には影響しません。

## インストール

VS Code **1.100 以降**が必要です。

1. 拡張機能ビューの `…` から **VSIX からのインストール…** を選択します。
2. `visual-japanese-spacing-0.0.1.vsix` を指定します。

VSIX のビルド方法は[開発ガイド](docs/development.md)に記載しています。

## 設定と使用方法

初期設定では Markdown とプレーンテキストが対象です。次の設定例では Python も追加しています。ユーザーまたはワークスペースの `settings.json` に設定します。

```json
{
  "visualJapaneseSpacing.enabled": true,
  "visualJapaneseSpacing.languages": ["markdown", "plaintext", "python"],
  "editor.inlayHints.enabled": "on",
  "editor.inlayHints.padding": false,
  "editor.inlayHints.maximumLength": 0
}
```

`editor.inlayHints.*` の 3 項目は、余白を常に表示し、背景のパディングと行単位の文字数制限をなくすために必要です。**同じ設定範囲のほかの拡張機能のインレイヒントにも影響します。** この拡張機能は、これらの設定を自動では変更しません。

`visualJapaneseSpacing.enabled` を `false` にすると無効になります。コマンドパレットでも操作できます。

- **Visual Japanese Spacing: Enable**: 有効化
- **Visual Japanese Spacing: Disable**: 無効化
- **Visual Japanese Spacing: Open Settings**: 設定画面を開く

Enable / Disable は、現在のファイルに適用されている設定スコープを更新します。上書きがなければユーザー設定を更新し、同じ設定を使うほかのファイルにも反映されます。

### その他の設定

- `visualJapaneseSpacing.languages`: 拡張子ではなく言語 ID を指定します。既定値は `["markdown", "plaintext"]`、`["*"]` は全言語、`[]` は対象なしです。
- `visualJapaneseSpacing.includeNumbers`: 既定値は `true` です。`false` にすると、日本語と数字の境界（`第1章` など）には余白を表示しません。

## 対象と制限

対象は、漢字・ひらがな・カタカナ・代表的な繰り返し記号・長音記号と、ASCII 英数字の境界です。既存の空白、一般的な句読点、全角英数字には追加しません。中国語の漢字も対象になります。

- 余白の幅はフォントに依存する約 2/3 em で、半角スペースと完全には一致しません。
- 余白の幅も折り返しに含まれるため、通常の文字だけの行より早く折り返すことがあります。
- 余白は文字ではないため、通常の空白と同じようにカーソルを置くことはできません。マウスによる選択の操作感も異なる場合があります。
- インレイヒントを無効にすると余白も非表示になります。非常に密な長文では、VS Code の表示数制限によって一部が省略されることがあります。
- 対象はテキストエディターのみです。Markdown プレビューやターミナルには対応していません。
- Markdown や Python の構文は解析しません。コードブロック、リンク、コメント、文字列、コード内部も文字の境界で判定します。

実行時の外部依存、通信、テレメトリー、文書への書き込みはありません。

## 関連文書

- [開発ガイド](docs/development.md)
- [検証結果と未検証の範囲](docs/development.md#検証)
- [変更履歴](CHANGELOG.md)
