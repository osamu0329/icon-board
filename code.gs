/**
 * 🌸 かわいいアイコンボード用 GASスクリプト (ID削除対応版)
 * * 設定手順:
 * 1. スプレッドシートの1行目を「name」「images」「date」「id」にする (4列)
 * 2. このコードを貼り付けて「新しいデプロイ」を作成
 * 3. アクセス権を「全員(Anyone)」にする
 */

/**
 * GETリクエストを受け取った際に実行される関数。
 * 掲示板の全投稿データをJSON形式で返却します。
 * キャッシュを利用することで、スプレッドシートへのアクセスを減らし高速化しています。
 */
function doGet() {
  // スクリプトキャッシュを取得します
  const cache = CacheService.getScriptCache();
  // 'posts_cache' というキーで保存されているキャッシュデータを取得します
  const cachedData = cache.get('posts_cache');

  // キャッシュが存在する場合、そのデータをそのまま返却します
  if (cachedData) {
    return ContentService.createTextOutput(cachedData)
      .setMimeType(ContentService.MimeType.JSON);
  }

  // キャッシュがない場合、スプレッドシートからデータを取得します
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  // 各行のデータをオブジェクトの配列に変換します
  const json = data.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  const jsonString = JSON.stringify(json);

  // 取得したデータを文字列としてキャッシュに保存します（有効期限は600秒＝10分）
  // 注意: CacheServiceの1項目あたりの上限は100KBです
  try {
    cache.put('posts_cache', jsonString, 600);
  } catch (e) {
    // データが100KBを超えた場合はキャッシュを諦めます（エラーは無視して継続）
    console.error("Cache put failed: " + e.message);
  }

  // 生成したJSON文字列を返却します
  return ContentService.createTextOutput(jsonString)
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * POSTリクエストを受け取った際に実行される関数。
 * 新規投稿の追加、または既存投稿の削除を行います。
 */
function doPost(e) {
  // キャッシュを操作するために取得します
  const cache = CacheService.getScriptCache();
  // 現在アクティブなスプレッドシートを取得します
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // スプレッドシートの最初（左端）のシートを取得します
  const sheet = ss.getSheets()[0];
  // リクエストボディに含まれるJSONデータをパースして取得します
  const postData = JSON.parse(e.postData.contents);
  
  // --- 削除処理 (IDで照合) ---
  // リクエスト内の action が 'delete' の場合、削除処理を実行します
  if (postData.action === 'delete') {
    // 削除対象となる投稿のIDを取得します
    const targetId = postData.id;
    // データの最終行を確認します
    const lastRow = sheet.getLastRow();

    // データがヘッダーのみ（1行以下）の場合は、削除対象がないため終了します
    if (lastRow <= 1) {
      return ContentService.createTextOutput("Not Found");
    }

    // 全データを取得する代わりに、IDが記載された4列目(D列)のみを検索対象にします
    // これによりメモリ消費量と処理速度が大幅に改善されます
    // 2行目から最終行までのID列（4列目）を取得します
    const range = sheet.getRange(2, 4, lastRow - 1);
    const finder = range.createTextFinder(targetId).matchCase(true).matchEntireCell(true);
    const result = finder.findNext();

    let deleted = false;
    if (result) {
      // 見つかったセルの行番号を取得し、その行全体を削除します
      sheet.deleteRow(result.getRow());
      deleted = true;
      // データが変更されたため、古いキャッシュを削除します
      cache.remove('posts_cache');
    }

    // 削除の成否をテキストで返却します
    return ContentService.createTextOutput(deleted ? "Deleted" : "Not Found");
  }

  // --- 新規投稿処理 ---
  // リクエストデータから投稿者の名前を取得します
  const name = postData.name;
  // リクエストデータから画像の情報を取得します
  const images = postData.images;
  // 現在の時刻を取得して投稿日時とします
  const date = new Date();
  // 重複の可能性が極めて低い一意なID（UUID）を生成します
  const id = Utilities.getUuid();
  
  // [名前, 画像, 日時, ID] の順でシートの末尾に新しい行を追加します
  sheet.appendRow([name, images, date, id]);

  // 新しい投稿が追加されたため、古いキャッシュを削除します
  cache.remove('posts_cache');
  
  // 処理が成功したことを示すメッセージを返却します
  return ContentService.createTextOutput("Success");
}
