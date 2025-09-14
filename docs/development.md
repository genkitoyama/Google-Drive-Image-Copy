# 開発ガイド

## 開発環境セットアップ

### 必要な環境

- Node.js 18+
- npm または yarn
- Google Chrome (開発・テスト用)

### プロジェクトセットアップ

```bash
# リポジトリのクローン
git clone <repository-url>
cd google-drive-image-copy-paste

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
google-drive-image-copy-paste/
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
- [ ] 右クリックメニューの表示
- [ ] カスタムメニューの表示
- [ ] 自動コピー成功時の通知
- [ ] 自動コピー失敗時の指示表示
- [ ] キーボードショートカット (Ctrl+Shift+C)

#### 画像形式対応
- [ ] JPEG画像のコピー
- [ ] PNG画像のコピー
- [ ] 大きな画像のコピー
- [ ] 小さな画像のコピー

#### エラーハンドリング
- [ ] Google Driveの共有設定エラー時の動作
- [ ] ネットワークエラー時の動作
- [ ] 認証エラー時の動作
- [ ] クリップボード権限がない時の動作

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

**最初に確認**: Google Driveの共有設定
- 画像が「リンクを知っている全員」または「一般公開」に設定されているか
- ファイル名下のアイコンで確認 (🔗 または 🌍 が表示されているか)

**その他のデバッグ項目**:
- Network タブでfetch状況確認
- Console でエラーログ確認
- クリップボード権限の確認

### デバッグのベストプラクティス

1. **段階的デバッグ**: 各処理段階でログ出力
2. **エラー情報の保存**: 本番環境でもエラーログを記録
3. **ユーザーフィードバック**: エラー時にわかりやすいメッセージ表示

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