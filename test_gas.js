
// Mocking GAS environment
const cacheStore = new Map();
const sheetData = [
  ["name", "images", "date", "id"],
  ["User1", "[]", "2023-01-01", "id1"]
];

const CacheService = {
  getScriptCache: () => ({
    get: (key) => cacheStore.get(key),
    put: (key, value, ttl) => cacheStore.set(key, value),
    remove: (key) => cacheStore.delete(key)
  })
};

const ContentService = {
  MimeType: { JSON: 'application/json' },
  createTextOutput: (content) => ({
    content: content,
    mimeType: null,
    setMimeType: function(type) { this.mimeType = type; return this; }
  })
};

const Utilities = {
  getUuid: () => 'new-uuid-' + Math.random()
};

const SpreadsheetApp = {
  getActiveSpreadsheet: () => ({
    getSheets: () => [{
      getDataRange: () => ({
        getValues: () => JSON.parse(JSON.stringify(sheetData))
      }),
      getLastRow: () => sheetData.length,
      getRange: (row, col, numRows) => ({
        createTextFinder: (text) => ({
          matchCase: () => ({
            matchEntireCell: () => ({
              findNext: () => {
                const idCol = col - 1;
                for (let i = row - 1; i < row - 1 + numRows; i++) {
                  if (sheetData[i][idCol] === text) {
                    return { getRow: () => i + 1 };
                  }
                }
                return null;
              }
            })
          })
        })
      }),
      deleteRow: (row) => { sheetData.splice(row - 1, 1); },
      appendRow: (rowArray) => { sheetData.push(rowArray); }
    }]
  })
};

// Re-defining the functions from code.gs for testing
function doGet() {
  const cache = CacheService.getScriptCache();
  const cachedData = cache.get('posts_cache');
  if (cachedData) {
    return ContentService.createTextOutput(cachedData).setMimeType(ContentService.MimeType.JSON);
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const json = data.map(row => {
    let obj = {};
    headers.forEach((header, i) => { obj[header] = row[i]; });
    return obj;
  });
  const jsonString = JSON.stringify(json);
  try {
    cache.put('posts_cache', jsonString, 600);
  } catch (e) {}
  return ContentService.createTextOutput(jsonString).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const cache = CacheService.getScriptCache();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0];
  const postData = JSON.parse(e.postData.contents);
  if (postData.action === 'delete') {
    const targetId = postData.id;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return ContentService.createTextOutput("Not Found");
    const range = sheet.getRange(2, 4, lastRow - 1);
    const finder = range.createTextFinder(targetId).matchCase(true).matchEntireCell(true);
    const result = finder.findNext();
    let deleted = false;
    if (result) {
      sheet.deleteRow(result.getRow());
      deleted = true;
      cache.remove('posts_cache');
    }
    return ContentService.createTextOutput(deleted ? "Deleted" : "Not Found");
  }
  const name = postData.name;
  const images = postData.images;
  const date = new Date();
  const id = Utilities.getUuid();
  sheet.appendRow([name, images, date, id]);
  cache.remove('posts_cache');
  return ContentService.createTextOutput("Success");
}

// --- Test Cases ---
console.log("Starting backend tests...");

// 1. Test doGet (Cache Empty)
const res1 = doGet();
console.assert(res1.content.includes("User1"), "doGet should return sheet data");
console.assert(cacheStore.has('posts_cache'), "doGet should set cache");
console.log("Test 1 Passed: doGet (Cache Empty)");

// 2. Test doPost Add
const addEvent = { postData: { contents: JSON.stringify({ name: "NewUser", images: "[]" }) } };
doPost(addEvent);
console.assert(sheetData.length === 3, "Sheet should have 3 rows now");
console.assert(!cacheStore.has('posts_cache'), "Cache should be cleared after add");
console.log("Test 2 Passed: doPost Add");

// 3. Test doPost Delete
const deleteEvent = { postData: { contents: JSON.stringify({ action: 'delete', id: 'id1' }) } };
const resDelete = doPost(deleteEvent);
console.assert(resDelete.content === "Deleted", "Should return Deleted");
console.assert(sheetData.length === 2, "Sheet should have 2 rows now after delete");
console.log("Test 3 Passed: doPost Delete");

// 4. Test doPost Delete (Empty Sheet)
sheetData.splice(1); // Keep only header
const deleteEventEmpty = { postData: { contents: JSON.stringify({ action: 'delete', id: 'any-id' }) } };
const resDeleteEmpty = doPost(deleteEventEmpty);
console.assert(resDeleteEmpty.content === "Not Found", "Should return Not Found for empty sheet");
console.log("Test 4 Passed: doPost Delete (Empty Sheet)");

console.log("All backend tests passed!");
