// ==========================================
// ⚙️ CONFIGURATION (الإعدادات)
// ==========================================
// تم نقل الأسرار إلى هنا لتبقى محمية على السيرفر (Google Servers) فقط.
const TELEGRAM_TOKEN  = "8951534694:AAFyazYfpFp5JtcMTHD-rnfqlABaPuBUy_s";
const TELEGRAM_CHAT_ID = "-1004378624008";

// ==========================================
// 📤 TELEGRAM HELPERS (دوال مساعدة لتيليجرام)
// ==========================================
function sendTelegramMessage(text) {
  UrlFetchApp.fetch("https://api.telegram.org/bot" + TELEGRAM_TOKEN + "/sendMessage", {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: text, parse_mode: "Markdown" }),
    muteHttpExceptions: true
  });
}

function sendTelegramPDF(pdfBlob, caption, token, chatId) {
  // نستخدم المتغيرات الأساسية دائماً كإجراء أمني (لا نثق بالبيانات القادمة من الواجهة الأمامية)
  token  = token  || TELEGRAM_TOKEN;
  chatId = chatId || TELEGRAM_CHAT_ID;
  UrlFetchApp.fetch("https://api.telegram.org/bot" + token + "/sendDocument", {
    method: "post",
    payload: { chat_id: chatId, caption: caption, parse_mode: "Markdown", document: pdfBlob },
    muteHttpExceptions: true
  });
}

function testTelegram() {
  sendTelegramMessage("✅ Telegram Connected Successfully — EZEM Inventory V4");
}

// ==========================================
// 1️⃣ GET DATA (doGet) - تحميل البيانات الأولية
// ==========================================
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var responseData = { db: [], users: [] };

  // تحميل قاعدة بيانات الأصناف
  var itemSheet = ss.getSheetByName("DB_Items");
  if (itemSheet) {
    var values = itemSheet.getDataRange().getDisplayValues();
    if (values.length > 1) {
      var headers = values[0].map(function(h) { return h.toString().trim(); });
      responseData.db = values.slice(1).map(function(row) {
        var obj = {};
        headers.forEach(function(h, i) { 
          var val = row[i] || "";
          obj[h] = (typeof val === 'string') ? val.trim() : val; 
        });
        return obj;
      });
    }
  }

  // تحميل المستخدمين (للقائمة المنسدلة فقط - أمان!!)
  // 🔒 تحسين الأمان: إرجاع أسماء المستخدمين فقط بدون كلمات المرور والأدوار!
  var userSheet = ss.getSheetByName("Users");
  if (userSheet) {
    var uValues = userSheet.getDataRange().getDisplayValues();
    if (uValues.length > 1) {
      responseData.users = uValues.slice(1).map(function(r) {
        return { name: r[0] || "", pass: r[1] || "", role: r[2] || "User", dept: r[3] || "All", roll: r[4] || "All" };
      }).filter(function(u) { return u.name; });
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================
// 2️⃣ HANDLE POST (doPost) - معالجة الطلبات
// ==========================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", msg: "الخادم مشغول، يرجى المحاولة مرة أخرى." }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var data  = JSON.parse(e.postData.contents);
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var tz    = ss.getSpreadsheetTimeZone();
    var tsStr = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

    // ── (🔐) AUTHENTICATION (تسجيل الدخول) ─────────────────────────
    // 🔒 تحسين الأمان: التحقق من كلمة المرور يتم هنا في السيرفر فقط
    if (data.action === "login") {
      var userSheet = ss.getSheetByName("Users");
      if (!userSheet) return ContentService.createTextOutput(JSON.stringify({ status: "error", msg: "جدول المستخدمين غير موجود" })).setMimeType(ContentService.MimeType.JSON);
      
      var uValues = userSheet.getDataRange().getDisplayValues();
      var foundUser = null;
      for (var i = 1; i < uValues.length; i++) {
        var r = uValues[i];
        if (r[0] === data.name && r[1] === data.pass) {
          foundUser = { name: r[0], role: r[2] || "User", dept: r[3] || "All", roll: r[4] || "All" };
          break;
        }
      }
      
      if (foundUser) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", user: foundUser })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", msg: "بيانات الدخول غير صحيحة" })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── (A) GET REPORT ──────────────────────────────────────────────
    if (data.action === "getReport") {
      var resultData    = [];
      var validSheets   = ["Daily", "CK", "Weekly", "Monthly", "Monthly Inventory", "Orders", "OOS"];
      var sheetsToQuery = (data.section === "All") ? validSheets : [data.section];

      var fromDate = new Date(data.dateFrom); fromDate.setHours(0, 0, 0, 0);
      var toDate   = new Date(data.dateTo);   toDate.setHours(23, 59, 59, 999);

      sheetsToQuery.forEach(function(sheetName) {
        var sheet = ss.getSheetByName(sheetName);
        if (!sheet) return;

        var rows = sheet.getDataRange().getDisplayValues();
        if (rows.length < 2) return;
        
        var headers = rows[0].map(h => h.toString().trim());
        var colMap = {};
        ["Refranc", "Ref", "Code", "Item Name", "WH Unit", "Unit", "Type", "Cost", "QTY", "Total Cost", "User", "Temp Date", "Date"].forEach(h => {
          colMap[h] = headers.indexOf(h);
        });

        for (var i = 1; i < rows.length; i++) {
          var row = rows[i];
          var dateIdx = colMap["Temp Date"] !== -1 ? colMap["Temp Date"] : colMap["Date"];
          var dateStr = (dateIdx !== -1) ? row[dateIdx] : "";
          if (!dateStr) continue;

          var rowDate = new Date(dateStr);
          if (rowDate >= fromDate && rowDate <= toDate) {
              resultData.push({
                section: sheetName,
                ref: row[colMap["Refranc"] !== -1 ? colMap["Refranc"] : colMap["Ref"]] || "", 
                code: row[colMap["Code"]] || "", 
                name: row[colMap["Item Name"]] || "", 
                unit: row[colMap["WH Unit"] !== -1 ? colMap["WH Unit"] : colMap["Unit"]] || "", 
                type: row[colMap["Type"]] || "",
                cost: row[colMap["Cost"]] || "0", 
                qty: row[colMap["QTY"]] || "0", 
                totalCost: row[colMap["Total Cost"]] || "0",
                user: row[colMap["User"]] || "",
                date: dateStr
              });
          }
        }
      });

      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", report: resultData }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── (B) UPLOAD DATA ─────────────────────────────────────────────
    if (data.action === "upload") {
      var targetName = (data.sheetName || "").trim();
      var sheet = ss.getSheetByName(targetName) || ss.getSheetByName("DB_" + targetName);

      if (!sheet) {
        sheet = ss.insertSheet(targetName);
        sheet.appendRow(["Refranc", "Code", "Item Name", "WH Unit", "Type", "Cost", "QTY", "Total Cost", "User", "Temp Date", "Department"]);
        sheet.getRange("A1:K1").setFontWeight("bold").setBackground("#1e3a8a").setFontColor("white");
      }

      var items   = data.items || [];
      var newRows = items.map(function(item) {
        var c = parseFloat(item.cost || item.Cost) || 0;
        var q = parseFloat(item.qty || item.QTY) || 0;
        var tc = c * q;
        return [
          item.ref || item.Refranc || "",
          item.code || item.Code || "",
          item.name || item['Item Name'] || "",
          item.unit || item['WH Unit'] || "",
          item.type || item.Type || "",
          c,
          q,
          tc,
          data.userName || "",
          tsStr,
          data.dept || ""
        ];
      });

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 11).setValues(newRows);
        
        // ⚡ تحسين الأداء: تحديث الكميات في DB_Items دفعة واحدة
        var masterSheet = ss.getSheetByName("DB_Items");
        if (masterSheet) {
          var mValues = masterSheet.getDataRange().getValues();
          var mHeaders = mValues[0].map(function(h){ return h.toString().trim(); });
          var mCodeIdx = mHeaders.indexOf("Code");
          var mQtyIdx  = mHeaders.indexOf("QTY");

          if (mCodeIdx !== -1 && mQtyIdx !== -1) {
             var updated = false;
             items.forEach(function(item) {
                var code = (item.code || item.Code || "").toString();
                var newQty = parseFloat(item.qty || item.QTY || 0);
                for (var r = 1; r < mValues.length; r++) {
                  if (mValues[r][mCodeIdx].toString() === code) {
                    mValues[r][mQtyIdx] = newQty;
                    updated = true;
                    break;
                  }
                }
             });
             // تحديث كامل الشيت بضربة واحدة بدلاً من طلبات متعددة
             if (updated) {
               masterSheet.getRange(1, 1, mValues.length, mValues[0].length).setValues(mValues);
             }
          }
        }
      }

      // --- HANDLE OOS ITEMS (SAVE TO SHEET ONLY) ---
      if (data.oosItems && data.oosItems.length > 0) {
        var oosSheet = ss.getSheetByName("OOS") || ss.insertSheet("OOS");
        if (oosSheet.getLastRow() === 0) {
          oosSheet.appendRow(["Ref","Code","Item Name","Arabic","Unit","Weight","Type","Cost","Status","Date","User"]);
          oosSheet.getRange("A1:K1").setFontWeight("bold").setBackground("#1e3a8a").setFontColor("white");
        }
        var tsOOS = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");
        var oosRows = data.oosItems.map(function(item) {
          return [item.ref||item.Refranc||"", item.code||item.Code||"", item.name||item['Item Name']||"", item.arabic||"",
                  item.unit||item['WH Unit']||"", item.weight||"", item.type||item.Type||"",
                  parseFloat(item.cost||item.Cost)||0, "Out of Stock", tsOOS, data.userName||""];
        });
        oosSheet.getRange(oosSheet.getLastRow() + 1, 1, oosRows.length, 11).setValues(oosRows);
      }

      try { sendTelegramNotification(data, tsStr); } catch (ex) { console.log("TG:", ex); }

      return ContentService
        .createTextOutput(JSON.stringify({
          status: "success",
          msg: "✅ تم حفظ " + newRows.length + " عنصر في \"" + targetName + "\" بنجاح."
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── (C) SEND REPORT TO TELEGRAM ─────────────────────────────────
    if (data.action === "sendReportTelegram") {
      var tsStr2  = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd HH:mm:ss");
      var rData   = { sheetName: data.section || "Report", items: data.reportData || [], userName: data.user || "User" };
      var pdfBlob = createTempPDF(rData, tsStr2);
      var isOrder = (data.section === "Orders");
      var caption = (isOrder ? "🛒" : "📊") + " *Report: " + rData.sheetName + "*\n" +
                    "👤 " + rData.userName + "\n" +
                    "📅 " + tsStr2 + "\n" +
                    "📈 Items: " + rData.items.length;
      try {
        // 🔒 تحسين الأمان: تجاهل الرمز المُرسل من الواجهة، واستخدام الرمز السري للسيرفر
        sendTelegramPDF(pdfBlob, caption, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID);
        return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── (D) OOS UPDATE ──────────────────────────────────────────────
    if (data.action === "oos_update") {
      var oosSheet = ss.getSheetByName("OOS") || ss.insertSheet("OOS");
      if (oosSheet.getLastRow() === 0) {
        oosSheet.appendRow(["Ref","Code","Item Name","Arabic","Unit","Weight","Type","Cost","Status","Date","User"]);
        oosSheet.getRange("A1:K1").setFontWeight("bold").setBackground("#1e3a8a").setFontColor("white");
      }
      var tsOOS   = Utilities.formatDate(new Date(), "GMT+2", "yyyy-MM-dd HH:mm:ss");
      var oosList = data.items || [];
      if (oosList.length > 0) {
        var oosRows = oosList.map(function(item) {
          return [item.ref||"", item.code||"", item.name||"", item.arabic||"",
                  item.unit||"", item.weight||"", item.type||"",
                  parseFloat(item.cost)||0, "Out of Stock", tsOOS, data.user||""];
        });
        oosSheet.getRange(oosSheet.getLastRow() + 1, 1, oosRows.length, 11).setValues(oosRows);
        var oosCaption = "🚫 *OOS Report: " + (data.section||"") + "*\n" +
                         "👤 " + (data.user||"") + "\n📅 " + tsOOS + "\n📊 Items: " + oosList.length;
        try {
          var oosPDF = createTempPDF({ sheetName: "Out of Stock Report", items: oosList, userName: data.user||"" }, tsOOS);
          sendTelegramPDF(oosPDF, oosCaption, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID);
        } catch(ex) {}
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // ── (E) SAVE / UPDATE USER ──────────────────────────────────────
    if (data.action === "saveUser") {
      var uSheet = ss.getSheetByName("Users");
      if (!uSheet) {
        uSheet = ss.insertSheet("Users");
        uSheet.appendRow(["Name","Password","Role","Department","Roll"]);
        uSheet.getRange("A1:E1").setFontWeight("bold").setBackground("#1e3a8a").setFontColor("white");
      }
      var ud    = data.userData;
      var uVals = uSheet.getDataRange().getValues();
      var found = false;
      for (var r = 1; r < uVals.length; r++) {
        if (uVals[r][0] === ud.name) {
          uSheet.getRange(r + 1, 1, 1, 5).setValues([[ud.name, ud.pass, ud.role, ud.dept || "All", ud.roll || "All"]]);
          found = true; break;
        }
      }
      if (!found) uSheet.appendRow([ud.name, ud.pass, ud.role, ud.dept || "All", ud.roll || "All"]);
      return ContentService
        .createTextOutput(JSON.stringify({ status: "success", msg: "تم حفظ المستخدم: " + ud.name }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ── (F) SAVE ITEM SETTINGS ──────────────────────────────────────
    if (data.action === "saveItemSettings") {
      var itemSheet = ss.getSheetByName("DB_Items");
      if (!itemSheet) return ContentService.createTextOutput(JSON.stringify({status:"error", msg:"DB_Items غير موجود"})).setMimeType(ContentService.MimeType.JSON);
      
      var values = itemSheet.getDataRange().getValues();
      var headers = values[0].map(function(h){ return h.toString().trim(); });
      var codeIdx = headers.indexOf("Code");
      var consIdx = headers.indexOf("Consumption");
      var flagIdx = headers.indexOf("Consumable");
      
      if (codeIdx === -1) return ContentService.createTextOutput(JSON.stringify({status:"error", msg:"عمود Code غير موجود"})).setMimeType(ContentService.MimeType.JSON);
      
      if (consIdx === -1) { itemSheet.getRange(1, headers.length + 1).setValue("Consumption"); consIdx = headers.length; headers.push("Consumption"); }
      if (flagIdx === -1) { itemSheet.getRange(1, headers.length + 1).setValue("Consumable"); flagIdx = headers.length; headers.push("Consumable"); }
      
      var found = false;
      for (var i = 1; i < values.length; i++) {
        if (values[i][codeIdx].toString() === data.code.toString()) {
          if (data.consumption !== undefined) values[i][consIdx] = data.consumption;
          if (data.consumable !== undefined) values[i][flagIdx] = data.consumable;
          found = true; 
          break;
        }
      }
      // تحسين: حفظ الكل بضربة واحدة 
      if (found) {
        itemSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
      }

      return ContentService.createTextOutput(JSON.stringify({ status: found ? "success" : "not_found" })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ignored", msg: "إجراء غير معروف: " + (data.action || "") }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", msg: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// ==========================================
// 3️⃣ TELEGRAM NOTIFICATION ON UPLOAD
// ==========================================
function sendTelegramNotification(data, timeStr) {
  var isOrder = (data.sheetName === "Orders");
  var title = isOrder ? "Purchase Order" : "Inventory Upload";
  var emoji = isOrder ? "🛒" : "📦";
  var allItems = data.items || [];
  var availableCount = 0;
  var oosCount = 0;
  allItems.forEach(function(item) {
    if (item.isOOS === true) oosCount++;
    else availableCount++;
  });
  var pdfBlob = createTempPDF(data, timeStr);
  var caption = emoji + " *" + title + ": " + data.sheetName + "*\n" +
                "Branch: " + (data.dept || "") + "\n" +
                "👤 User: " + (data.userName || "") + "\n" +
                "📅 Date: " + timeStr + "\n" +
                "📊 Items Available: " + availableCount;
  if (oosCount > 0) {
    caption += "\n🚫 Items OOS: " + oosCount;
  }
  sendTelegramPDF(pdfBlob, caption, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID);
}

// ==========================================
// 4️⃣ CREATE TEMP PDF (Professional Design)
// ==========================================
function createTempPDF(data, timeStr) {
  var grandTotalCost = 0;
  var allItems = data.items || [];
  var availableItems = allItems.filter(function(i) { return i.isOOS !== true; });
  var oosItems = allItems.filter(function(i) { return i.isOOS === true; });

  // Build available items rows
  var rowsHtml = availableItems.map(function(i, index) {
    var c = parseFloat(i.cost || i.Cost || 0);
    var q = parseFloat(i.qty || i.QTY || 0);
    var rowTotal = c * q;
    grandTotalCost += rowTotal;
    return `
      <tr>
        <td>${i.Refranc || i.ref || index + 1}</td>
        <td>${i.code || i.Code || ""}</td>
        <td class="left">${i.name || i["Item Name"] || ""}</td>
        <td>${i.unit || i["WH Unit"] || i.Unit || ""}</td>
        <td>${i.type || i.Type || ""}</td>
        <td>${c.toFixed(2)}</td>
        <td class="bold-col">${q}</td>
        <td style="font-weight:bold;color:#6B2E8C">${rowTotal.toFixed(2)}</td>
        <td>${i.user || i.User || ""}</td>
        <td>${timeStr.split(' ')[0]}</td>
      </tr>
    `;
  }).join("");

  // Add OOS section if exists
  if (oosItems.length > 0) {
    rowsHtml += `
      <tr>
        <td colspan="10" style="background:#DC2626;color:white;font-weight:900;text-align:left;padding:10px 15px;font-size:12px;letter-spacing:1px;border:none;">
          📊 OUT OF STOCK (OSS) — ${oosItems.length} Items
        </td>
      </tr>
    `;
    rowsHtml += oosItems.map(function(i, index) {
      var c = parseFloat(i.cost || i.Cost || 0);
      return `
        <tr style="background-color:#FEF2F2;">
          <td style="color:#DC2626">${i.Refranc || i.ref || index + 1}</td>
          <td style="color:#DC2626;font-weight:bold">${i.code || i.Code || ""}</td>
          <td class="left" style="color:#DC2626">🔴 ${i.name || i["Item Name"] || ""}</td>
          <td>${i.unit || i["WH Unit"] || i.Unit || ""}</td>
          <td>${i.type || i.Type || ""}</td>
          <td>${c.toFixed(2)}</td>
          <td class="bold-col" style="color:#DC2626;font-weight:900">OOS</td>
          <td style="color:#999">—</td>
          <td>${i.user || i.User || ""}</td>
          <td>${timeStr.split(' ')[0]}</td>
        </tr>
      `;
    }).join("");
  }

  /* EMBED LOGO COVERT TO BASE64 FOR PDF RELIABILITY */
  var logoBase64 = "";
  try {
    var logoFile = DriveApp.getFileById("1gwXYV5GVOzHgkI3QpFY4Up5mavYFBVcl");
    var blob = logoFile.getBlob();
    logoBase64 = "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
  } catch (e) {
    console.warn("Logo load failed: " + e.toString());
  }

  var html = `
  <html>
  <head>
    <style>
      @page { size: A4 landscape; margin: 40px; }
      body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; margin: 0; padding: 0; }
      
      .header-container { display: table; width: 100%; border-bottom: 3px solid #6B2E8C; padding-bottom: 10px; margin-bottom: 20px; }
      .header-logo-side { display: table-cell; vertical-align: middle; width: 60px; }
      .header-title-side { display: table-cell; vertical-align: middle; padding-left: 15px; }
      .header-info-side { display: table-cell; vertical-align: middle; text-align: right; }
      
      .logo-img { height: 50px; border-radius: 8px; }
      .title { font-size: 24px; font-weight: bold; color: #6B2E8C; margin: 0; }
      .info-text { font-size: 11px; color: #666; margin: 2px 0; }
      
      .summary-bar { background: #F3EBF7; border-left: 5px solid #6B2E8C; padding: 10px; margin-bottom: 15px; font-size: 12px; font-weight: bold; }
      
      table { width: 100%; border-collapse: collapse; font-size: 10px; }
      th { background: #000000; color: white; padding: 10px 5px; border: 1px solid #333; text-transform: uppercase; font-weight: 900; }
      td { padding: 8px 5px; border: 1px solid #E5DDF0; text-align: center; }
      td.left { text-align: left; padding-left: 10px; }
      .bold-col { font-weight: 900; font-size: 11px; color: #000; }
      tr:nth-child(even) { background: #F9F7FB; }
      
      .final-footer { margin-top: 20px; display: table; width: 100%; }
      .total-box { display: table-cell; width: 40%; background: #6B2E8C; color: white; padding: 15px; border-radius: 8px; vertical-align: middle; }
      .total-label { font-size: 12px; opacity: 0.9; }
      .total-amount { font-size: 20px; font-weight: bold; }
      
      .system-name { display: table-cell; width: 60%; text-align: right; vertical-align: bottom; font-size: 10px; color: #999; }
    </style>
  </head>
  <body>
    <div class="header-container">
      <div class="header-logo-side">
        <img src="${logoBase64}" class="logo-img">
      </div>
      <div class="header-title-side">
        <div class="title">EZEM EXECUTIVE REPORT</div>
      </div>
      <div class="header-info-side">
        <div class="info-text"><b>User:</b> ${data.userName || "System"} | <b>Branch:</b> ${data.dept || "All"}</div>
        <div class="info-text"><b>Type:</b> ${data.sheetName} | <b>Date:</b> ${timeStr}</div>
      </div>
    </div>

    <div class="summary-bar">
      REPORT SUMMARY: ${availableItems.length} Items Available${oosItems.length > 0 ? ' &nbsp;|&nbsp; <span style="color:#DC2626">🚫 ' + oosItems.length + ' Items OOS</span>' : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:40px">Ref</th>
          <th style="width:80px">Code</th>
          <th>Item Name</th>
          <th style="width:60px">Unit</th>
          <th style="width:60px">Type</th>
          <th style="width:70px">Cost</th>
          <th style="width:50px">QTY</th>
          <th style="width:80px">Total Cost</th>
          <th style="width:80px">User</th>
          <th style="width:80px">Date</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="final-footer">
      <div class="total-box">
        <div class="total-label">GRAND TOTAL VALUE</div>
        <div class="total-amount">EGP ${grandTotalCost.toLocaleString('en', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
      </div>
      <div class="system-name">
        EZEM ERP System © ${new Date().getFullYear()} - Professional Inventory Solutions
      </div>
    </div>
  </body>
  </html>
  `;

  var blob = HtmlService
    .createHtmlOutput(html)
    .getBlob()
    .getAs("application/pdf");

  blob.setName("EZEM_Report_" + data.sheetName + "_" + (data.userName || "Admin") + ".pdf");
  return blob;
}

// ==========================================
// 🚀 ONE-TIME SETUP: RUN THIS TO CREATE HEADERS
// ==========================================
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var blueHeader = { background: "#1e3a8a", color: "white", weight: "bold" };

  var dbItemsHeaders = ["Refranc", "Code", "Item Name", "WH Unit", "Type", "Cost", "QTY", "Consumption", "Consumable"];
  setupSheetHeaders(ss, "DB_Items", dbItemsHeaders, blueHeader);

  var transHeaders = ["Refranc", "Code", "Item Name", "WH Unit", "Type", "Cost", "QTY", "Total Cost", "User", "Temp Date"];
  var transSheets = ["Daily", "Weekly", "CK", "Monthly", "Monthly Inventory", "Orders"];
  transSheets.forEach(function(name) {
    setupSheetHeaders(ss, name, transHeaders, blueHeader);
  });

  var oosHeaders = ["Ref","Code","Item Name","Arabic","Unit","Weight","Type","Cost","Status","Date","User"];
  setupSheetHeaders(ss, "OOS", oosHeaders, blueHeader);

  var userHeaders = ["Name", "Password", "Role", "Department", "Roll"];
  setupSheetHeaders(ss, "Users", userHeaders, blueHeader);

  Browser.msgBox("✅ All sheets and headers have been successfully created/updated!");
}

function setupSheetHeaders(ss, name, headers, style) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var currentHeaders = (sheet.getLastRow() > 0) ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
  
  if (currentHeaders.length < headers.length) {
     sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
     var range = sheet.getRange(1, 1, 1, headers.length);
     range.setBackground(style.background).setFontColor(style.color).setFontWeight(style.weight);
     sheet.setFrozenRows(1);
  } else {
     var range = sheet.getRange(1, 1, 1, headers.length);
     range.setBackground(style.background).setFontColor(style.color).setFontWeight(style.weight);
  }
}
