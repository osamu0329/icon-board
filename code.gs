/**
 * 🌸 かわいいアイコンボード用 GASスクリプト (ID削除対応版)
 * * 設定手順:
 * 1. スプレッドシートの1行目を「name」「images」「date」「id」にする (4列)
 * 2. このコードを貼り付けて「新しいデプロイ」を作成
 * 3. アクセス権を「全員(Anyone)」にする
 */

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  const json = data.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header] = row[i];
    });
    return obj;
  });
  
  return ContentService.createTextOutput(JSON.stringify(json))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const postData = JSON.parse(e.postData.contents);
  
  // --- 削除処理 (IDで照合) ---
  if (postData.action === 'delete') {
    const targetId = postData.id;
    const data = sheet.getDataRange().getValues();
    let deleted = false;

    // 4列目(インデックス3)のIDをチェック
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][3].toString() === targetId.toString()) {
        sheet.deleteRow(i + 1);
        deleted = true;
        break;
      }
    }
    return ContentService.createTextOutput(deleted ? "Deleted" : "Not Found");
  }

  // --- 新規投稿処理 ---
  const name = postData.name;
  const images = postData.images;
  const date = new Date();
  // 重複しないIDを作成
  const id = Utilities.getUuid();
  
  sheet.appendRow([name, images, date, id]);
  
  return ContentService.createTextOutput("Success");
}
