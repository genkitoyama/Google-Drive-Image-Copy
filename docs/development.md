# 開発ガイド

## 開発環境セットアップ

### 必要な環境

- Node.js 18+
- npm または yarn
- Google Chrome (開発・テスト用)

### プロジェクトセットアップ

```bash
# リポジトリのクローン
git clone https://github.com/genkitoyama/Google-Drive-Image-Copy.git
cd Google-Drive-Image-Copy

# 依存関係のインストール
npm install

# 初回ビルド
npm run build
```

## 開発ワークフロー

### 1. 開発サーバー起動

```bash
# ファイル変更を監視してオートビルド
npm run watch
```

### 2. Chrome拡張機能として読み込み

1. `chrome://extensions/` を開く
2. 「デベロッパーモード」をON
3. 「パッケージ化されていない拡張機能を読み込む」
4. プロジェクトルートディレクトリを選択

### 3. 開発・デバッグサイクル

1. ソースコード編集（`src/` 内のTypeScriptファイル）
2. 自動ビルド（`npm run watch` 実行時）
3. Chrome拡張機能の「更新」ボタンをクリック
4. Google Driveでテスト
5. デバッグ・修正を繰り返し

## プロジェクト構造

```
Google-Drive-Image-Copy/
├── src/                    # TypeScriptソースコード
│   ├── content.ts         # メインロジック
│   └── background.ts      # バックグラウンド処理
├── dist/                  # ビルド出力（自動生成）
├── docs/                  # ドキュメント
├── icons/                 # 拡張機能アイコン
├── manifest.json          # 拡張機能設定
├── tsconfig.json         # TypeScript設定
└── package.json          # プロジェクト設定
```

## ビルドスクリプト

```json
{
  "scripts": {
    "build": "tsc",              # 本番ビルド
    "watch": "tsc -w",           # 開発用監視ビルド
    "clean": "rm -rf dist",      # ビルド出力クリア
    "prebuild": "npm run clean"  # ビルド前クリーンアップ
  }
}
```

## デバッグ方法

### Chrome DevTools活用

#### 1. サービスワーカーのデバッグ

```bash
# chrome://extensions/ で「サービスワーカー」リンクをクリック
# → バックグラウンド処理のコンソールが開く
```

#### 2. コンテンツスクリプトのデバッグ

```bash
# Google Driveページで F12
# → コンテンツスクリプトのログが表示
```

#### 3. ネットワーク監視

```bash
# DevTools > Network タブ
# → 画像fetch状況を確認
```

### ログレベル設定

本番環境では必要に応じてログレベルを調整：

```typescript
// 開発時: 詳細ログ
console.log('Trying URL variation...', url);

// 本番時: エラーのみ
if (process.env.NODE_ENV !== 'production') {
  console.log('Debug info:', data);
}
```

## テスト戦略

### 手動テスト項目

#### 基本機能
- [ ] 右クリック時のカスタムメニュー表示
- [ ] 「🚀 画像をコピー」ボタンの機能
- [ ] 自動コピー成功時の通知
- [ ] エラー時の詳細メッセージ表示
- [ ] エラー種別の自動判定と解決方法提示

#### 画像形式対応
- [ ] JPEG画像のコピー
- [ ] PNG画像のコピー
- [ ] 大きな画像のコピー
- [ ] 小さな画像のコピー

#### スマートエラーハンドリング
- [ ] 🔒 共有設定エラーの自動検出と詳細手順表示
- [ ] 🌐 ネットワークエラーの検出と再試行機能
- [ ] 📋 クリップボードエラーの検出と設定手順表示
- [ ] 🖼️ 画像未検出エラーの処理
- [ ] エラータイプ別の適切なアイコンとメッセージ表示

#### ブラウザ互換性
- [ ] Chrome最新版
- [ ] Chrome旧版（1-2バージョン前）
- [ ] Edge（Chromiumベース）

### 自動テスト（将来的な実装案）

```typescript
// Jest + Puppeteer での E2E テスト例
describe('Google Drive Image Copy', () => {
  test('should copy image successfully', async () => {
    await page.goto('https://drive.google.com');
    await page.rightClick('img');
    await page.click('[data-testid="copy-image-btn"]');

    const clipboardContent = await page.evaluate(() =>
      navigator.clipboard.read()
    );

    expect(clipboardContent[0].types).toContain('image/png');
  });
});
```

## リリース準備

### 1. バージョン更新

```json
// package.json
{
  "version": "1.1.0"
}

// manifest.json
{
  "version": "1.1.0"
}
```

### 2. 本番ビルド

```bash
# クリーンビルド
npm run clean
npm run build

# ファイル確認
ls -la dist/
```

### 3. 動作確認

- [ ] 全機能のテスト完了
- [ ] コンソールエラーなし
- [ ] パフォーマンス問題なし

### 4. パッケージ作成

```bash
# 拡張機能パッケージ作成
zip -r google-drive-image-copy-v1.1.0.zip \
  manifest.json \
  dist/ \
  icons/ \
  -x "*.map"
```

## トラブルシューティング

### よくある問題

#### 1. TypeScriptコンパイルエラー

```bash
# 型定義の確認
npm install --save-dev @types/chrome

# 設定確認
cat tsconfig.json
```

#### 2. Chrome拡張機能が読み込めない

- manifest.json の構文確認
- 必要なファイルの存在確認
- 権限設定の確認

#### 3. 画像コピーが動作しない

**自動エラー診断機能を確認**:
- 拡張機能が自動的にエラー種別を判定し、適切な解決方法を提示しているか
- 🔒 共有設定エラー: 詳細な手順が表示されるか
- 🌐 ネットワークエラー: 再試行ボタンが機能するか

**手動デバッグ手順**:
- Network タブでGoogle Drive APIアクセス状況確認
- Console でエラーログとコンテキスト検証状況確認
- クリップボード権限設定確認

### デバッグのベストプラクティス

1. **スマートエラーハンドリング**: エラー種別を自動判定し、適切な解決方法を提示
2. **コンテキスト検証**: 拡張機能コンテキストの有効性を常時監視
3. **ユーザーフレンドリーメッセージ**: エラー種別に応じたアイコンと詳細な解決手順を表示
4. **パフォーマンス監視**: Clipboard API直接使用で高速処理を実現

## コード品質管理

### ESLint設定（推奨）

```json
{
  "extends": [
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

### Prettier設定（推奨）

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80
}
```

## 貢献ガイドライン

1. フォークしてブランチ作成
2. 機能実装・バグ修正
3. テスト実行・確認
4. プルリクエスト作成
5. コードレビュー対応

詳細は CONTRIBUTING.md を参照（今後作成予定）