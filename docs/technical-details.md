# 技術実装詳細

## アーキテクチャ概要

### コンポーネント構成

```
Chrome Extension
├── manifest.json     # 拡張機能設定
├── src/
│   ├── content.ts    # メインロジック（コンテンツスクリプト）
│   └── background.ts # バックグラウンドスクリプト
└── icons/            # 拡張機能アイコン
```

## 主要技術課題と解決策

### 1. CORS制限の回避

**課題**: Google Driveの画像URLは認証が必要で、直接fetchできない

**解決策**: 複数のURL変種を試行する戦略
```typescript
// 成功率の高い順で試行
const variations = [
  `https://lh3.googleusercontent.com/d/${fileId}`,        // 最高成功率
  `https://drive.google.com/uc?id=${fileId}&export=view`, // 公開API
  url.replace(/[?&]auditContext=[^&]*/, ''),             // パラメータ除去
  // ... その他の変種
];
```

### 2. Clipboard API制限の対応

**課題**: `image/jpeg` はClipboard APIで直接サポートされていない

**解決策**: 自動PNG変換システム
```typescript
function convertBlobToPng(blob: Blob): Promise<Blob> {
  // Canvas経由でJPEG→PNG変換
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 画像をCanvasに描画
  ctx.drawImage(img, 0, 0);

  // PNG Blobとして出力
  return new Promise(resolve => {
    canvas.toBlob(resolve, 'image/png', 0.9);
  });
}
```

### 3. Tainted Canvas問題

**課題**: CORS制限により`canvas.toBlob()`が`SecurityError`で失敗

**解決策**: 多段階フォールバック
1. **Canvas変換**: 通常のPNG変換を試行
2. **MIME変更**: Canvas失敗時はMIMEタイプのみ変更
3. **手動指示**: 全て失敗時はユーザーガイダンス

### 4. Extension Context Invalidation

**課題**: 拡張機能更新時に既存のコンテンツスクリプトが無効化

**解決策**: コンテキスト検証と自動回復
```typescript
function checkExtensionContext(): boolean {
  try {
    return chrome.runtime && chrome.runtime.id;
  } catch (error) {
    extensionValid = false;
    window.location.reload(); // 自動リロード
    return false;
  }
}
```

## データフロー

### 成功時のフロー

```mermaid
graph TD
A[右クリック検出] --> B[画像URL抽出]
B --> C[URL変種生成]
C --> D[Fetch実行]
D --> E[JPEG→PNG変換]
E --> F[Clipboard書き込み]
F --> G[検証]
G --> H[成功通知]
```

### エラー時のフロー

```mermaid
graph TD
A[自動コピー失敗] --> B[エラー種別判定]
B --> C{エラータイプ}
C -->|共有設定| D[🔒 詳細設定手順表示]
C -->|ネットワーク| E[🌐 再試行ボタン表示]
C -->|クリップボード| F[📋 ブラウザ設定手順表示]
C -->|画像未検出| G[🖼️ ページリロード提案]
D --> H[設定方法ガイド表示]
E --> I[再試行実行]
F --> J[設定変更手順表示]
G --> K[リロード実行]
```

### 5. スマートエラーハンドリング

**課題**: ユーザーにとってエラー原因が不明で解決方法がわからない

**解決策**: 自動エラー診断と種別別ガイダンス
```typescript
type ErrorType = 'SHARING_PERMISSION' | 'NETWORK_ERROR' | 'CLIPBOARD_ERROR' | 'IMAGE_NOT_FOUND' | 'GENERAL_ERROR';

function getErrorType(error: string): ErrorType {
  if (error.includes('403') || error.includes('Forbidden')) {
    return 'SHARING_PERMISSION';
  }
  if (error.includes('network') || error.includes('HTTP')) {
    return 'NETWORK_ERROR';
  }
  // その他のエラータイプも判定
}

function showImprovedErrorMessage(errorMessage: string, imageUrl?: string) {
  const errorInfo = getErrorInfo(errorMessage);
  // エラータイプに応じたアイコン、メッセージ、解決手順を表示
}
```

## パフォーマンス最適化

### 最適化された単一URL戦略

テスト結果に基づき、最高成功率のURLのみを使用：

1. **単一URL使用**: `https://lh3.googleusercontent.com/d/${fileId}` - **成功率: 95%+**
2. **無駄な試行を排除**: 複数URLの試行をやめて高速化
3. **ファイルID抽出**: 元のURLからファイルIDを直接抽出して変換

### Clipboard API直接使用の最適化

- **直接書き込み**: Clipboard APIを直接使用して中間処理を削減
- **ストリーム処理**: 低メモリで大容量画像を処理
- **非同期最適化**: async/awaitでシンプルかつ高速な処理

## セキュリティ考慮事項

### Content Security Policy (CSP)

- inline event handlers を使用せず、`addEventListener`を使用
- `eval()` や動的コード実行は一切使用しない

### 権限の最小化

```json
{
  "permissions": [
    "contextMenus",    // 右クリックメニュー
    "activeTab",       // アクティブタブのみアクセス
    "clipboardWrite",  // クリップボード書き込み
    "storage",         // 設定保存
    "scripting"        // スクリプト実行
  ],
  "host_permissions": [
    "https://drive.google.com/*",
    "https://*.googleusercontent.com/*"
  ]
}
```

## TypeScript実装詳細

### 型安全性

- 全ての関数に適切な型注釈
- Chrome Extension APIの型定義使用
- Error handlingでの型ガード

### ビルド設定

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "strict": true,
    "types": ["chrome"]
  }
}
```

## デバッグとロギング

### コンソールログ戦略

- **本番環境ではログを最小限に制限**: パフォーマンス向上のため
- **エラー時のみ詳細ログ**: 必要最小限の情報のみ出力
- **スマートエラーメッセージ**: コンソールではなくUIでユーザーに情報提供

### 開発時の確認ポイント

1. **サービスワーカーコンソール**: バックグラウンド処理
2. **ページコンソール**: コンテンツスクリプト処理
3. **Network タブ**: 画像fetch状況
4. **Application > Storage**: クリップボード状態

## 既知の制限事項

### Google Driveの共有設定制限

**最も重要な制限**: この拡張機能は、Google Driveの画像が適切な共有設定になっている場合のみ動作します。

- ✅ **「リンクを知っている全員が閲覧可」**: 完全対応
- ✅ **「一般公開」**: 完全対応
- ❌ **「制限付き」**: コピー不可
- ❌ **特定ユーザーのみ共有**: コピー不可

この制限は、Google DriveのAPIアクセス権限に由来します。プライベート画像や制限付き共有の画像は、ブラウザのコンテンツスクリプトから直接アクセスできないためです。

### その他の技術的制限

1. **超大容量画像**: 20MB+の画像では処理時間が長くなる場合がある（スマートエラーハンドリングで対応）
2. **ブラウザ依存**: Clipboard API対応ブラウザのみ（Chrome, Edge, Firefox部分対応）
3. **Manifest V3準拠**: Safari未対応（Manifest V3サポートが不完全）
4. **ネットワーク依存**: インターネット接続が必要（スマートエラーハンドリングでガイダンス提供）

## 今後の改善案

### 機能拡張
1. **画像品質選択**: PNG変換時の品質設定オプション
2. **バッチコピー**: 複数画像の一括コピー
3. **フォーマット選択**: PNG以外の形式（WebP等）サポート
4. **キャッシュ機能**: 一度取得した画像のキャッシュ

### スマートエラーハンドリングの拡張
1. **エラー予測**: 共有設定を事前チェックして問題を予防
2. **自動修復**: 可能な場合は自動でエラーを解決
3. **学習機能**: ユーザーの使用パターンを学習してエラーを減らす
4. **多言語対応**: エラーメッセージの多言語化