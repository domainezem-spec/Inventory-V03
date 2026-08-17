const fs = require('fs');

const ASSETS = "F:/Branchs'/The Drive 2/project-EZEM/sys inv/assets";
const htmlRaw = fs.readFileSync(ASSETS + '/TheDrive2-Inventory-V.4.html', 'utf8');
const jsRaw = fs.readFileSync(ASSETS + '/app.js', 'utf8');

// Combine
let html = htmlRaw.replace('<script src="assets/app.js"></script>', `<script>\n${jsRaw}\n</script>`);

// Fix 1: loginUser function (create one to handle session restoring)
// Actually we can just replace `function attemptLogin() { ... }` fully.
const attemptLoginOld = jsRaw.substring(
  jsRaw.indexOf('    function attemptLogin() {'),
  jsRaw.indexOf('    async function logout() {')
);

const attemptLoginNew = `    async function attemptLogin() {
      const n = document.getElementById('user-select').value;
      const p = document.getElementById('user-pass').value;
      if(!n || !p) {
        document.getElementById('err-msg').innerText = 'Please select user and enter password.';
        document.getElementById('err-msg').style.display = 'block';
        return;
      }
      document.getElementById('err-msg').style.display = 'none';
      
      let u = null;
      if (masterData && masterData.users) {
        u = masterData.users.find(x => x.name === n && x.pass == p);
      }

      if(!u) {
         try {
           document.getElementById('err-msg').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying on server...';
           document.getElementById('err-msg').style.display = 'block';
           const res = await fetch(SCRIPT_URL, { method: 'POST', body: JSON.stringify({ action: 'login', name: n, pass: p }) });
           const result = await res.json();
           if(result.status === 'success') {
             u = result.user;
           } else {
             document.getElementById('err-msg').innerText = 'Authentication Failed. Check your password.';
             document.getElementById('err-msg').style.display = 'block';
             return;
           }
         } catch(err) {
           document.getElementById('err-msg').innerText = 'Network Error. Cannot reach server.';
           document.getElementById('err-msg').style.display = 'block';
           return;
         }
      }

      // If we reach here, we have u (from local or server)
      document.getElementById('err-msg').style.display = 'none';
      currentUser = n;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('display-user').innerText = n;
      
      const userDept = u.dept || 'All';
      document.querySelectorAll('.tab-btn').forEach(btn => {
        const tabName = btn.getAttribute('onclick').match(/'([^']+)'/)[1];
        if(u.role === 'Admin') {
          btn.style.display = 'inline-block';
        } else {
          if(tabName === 'OOS' || tabName === userDept || userDept === 'All') {
            btn.style.display = 'inline-block';
          } else {
            btn.style.display = 'none';
          }
        }
      });

      if(u.role === 'Admin') {
        document.getElementById('btn-master').style.display = 'inline-block';
        document.getElementById('btn-admin-report').style.display = 'flex';
        document.getElementById('btn-admin-users').style.display = 'flex';
        document.getElementById('admin-badge').style.display = 'inline-block';
        document.getElementById('btn-user-mgmt').style.display = 'inline-block';
      }
      
      const h = new Date().getHours();
      const greeting = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
      showAlert(\`\${greeting}, \${n}! Welcome to EZEM Inventory V4.\`,'success','Welcome!');
      
      if(u.role !== 'Admin' && userDept !== 'All') switchTab(userDept);
      else switchTab('Daily');
    }
\n`;
html = html.replace(attemptLoginOld, attemptLoginNew);


// Fix 2: populateLogin
const popLoginOld = `    function populateLogin(users) {
      const s = document.getElementById('user-select');
      users.forEach(u => { let o = document.createElement('option'); o.value=u.name; o.text=u.name; s.appendChild(o); });
    }`;
const popLoginNew = `    function populateLogin(users) {
      const s = document.getElementById('user-select');
      users.forEach(u => { 
        const userName = u.name || u.Name || '';
        if(!userName) return;
        let o = document.createElement('option'); o.value=userName; o.text=userName; s.appendChild(o); 
      });
    }`;
html = html.replace(popLoginOld, popLoginNew);


// Fix 3: OOS Header
const thOldStr = 'thead.innerHTML = `<tr><th class="sticky-col sticky-col-ref">Refranc</th><th class="sticky-col sticky-col-code">Code</th><th class="sticky-col sticky-col-qty" style="background:rgba(99,102,241,.15)">QTY</th><th style="text-align:left">Item Name</th><th>WH Unit</th><th>Type</th><th>Cost</th><th>OOS</th></tr>`;';
const thNewStr = 'thead.innerHTML = `<tr><th class="oos-col" style="width:40px">OOS</th><th class="sticky-col sticky-col-ref">Refranc</th><th class="sticky-col sticky-col-code">Code</th><th class="sticky-col sticky-col-qty" style="background:rgba(99,102,241,.15)">QTY</th><th style="text-align:left">Item Name</th><th>WH Unit</th><th>Type</th><th>Cost</th></tr>`;';
html = html.replace(thOldStr, thNewStr);


// Fix 4: OOS Row
const trOldStr = "tr.innerHTML = `<td class=\"sticky-col sticky-col-ref\">${item.Refranc||item.ref||'-'}</td><td class=\"sticky-col sticky-col-code\">${item.Code}</td><td class=\"sticky-col sticky-col-qty\"><input type=\"number\" class=\"qty-input ${val ? 'has-value' : ''}\" value=\"${val}\" oninput=\"saveD('${item.Code}',this)\" ${itemOOS ? 'disabled' : ''}></td><td style=\"text-align:left\">${item['Item Name']}</td><td style=\"color:var(--text-muted)\">${item['WH Unit']||''}</td><td>${item.Type||''}</td><td style=\"color:#f472b6;font-weight:600\">${cost > 0 ? cost.toFixed(2) : '-'}</td><td class=\"oos-cell\"><input type=\"checkbox\" class=\"oos-toggle\" ${itemOOS ? 'checked' : ''} onchange=\"toggleOOS('${currentTab}','${item.Code}',this.checked)\"></td>`;";
const trNewStr = "tr.innerHTML = `<td class=\"oos-cell\" style=\"width:40px;text-align:center\">\n            <input type=\"checkbox\" class=\"oos-toggle\" ${itemOOS ? 'checked' : ''} onchange=\"toggleOOS('${currentTab}','${item.Code}',this.checked)\">\n          </td><td class=\"sticky-col sticky-col-ref\">${item.Refranc||item.ref||'-'}</td><td class=\"sticky-col sticky-col-code\">${item.Code}</td><td class=\"sticky-col sticky-col-qty\"><input type=\"number\" class=\"qty-input ${val ? 'has-value' : ''}\" value=\"${val}\" oninput=\"saveD('${item.Code}',this)\" ${itemOOS ? 'disabled' : ''}></td><td style=\"text-align:left\">${item['Item Name']}</td><td style=\"color:var(--text-muted)\">${item['WH Unit']||''}</td><td>${item.Type||''}</td><td style=\"color:#f472b6;font-weight:600\">${cost > 0 ? cost.toFixed(2) : '-'}</td>`;";
html = html.replace(trOldStr, trNewStr);


// Fix 5: confirmUpload
const upOld = jsRaw.substring(
  jsRaw.indexOf('    async function confirmUpload() {'),
  jsRaw.indexOf('    async function clearAllInputs() {')
);

const upNew = `    async function confirmUpload() {
      const isMaster = currentTab === 'Monthly Inventory';
      if(currentTab === 'OOS') return showAlert('OOS tab is view-only. Switch to another tab to upload.','warning');
      if(!await showConfirm('Upload data to ' + currentTab + '?','Upload Confirmation')) return;
      let uploadItems = [];
      let oosItems = [];
      
      if(isMaster) {
        uploadItems = combinedInventory.map(i => {
          const q1 = localStorage.getItem('draft_Master_' + i.Code + '_q1');
          const q2 = localStorage.getItem('draft_Master_' + i.Code + '_q2');
          const q3 = localStorage.getItem('draft_Master_' + i.Code + '_q3');
          const total = (parseFloat(q1)||0)+(parseFloat(q2)||0)+(parseFloat(q3)||0);
          return {
            Code: i.Code,
            'Item Name': i['Item Name'],
            'WH Unit': i['WH Unit'] || '',
            Refranc: i.Refranc || i.ref || '',
            Type: i.Type || '',
            Cost: parseFloat(i.Cost)||0,
            QTY: total
          };
        }).filter(i => i.QTY > 0);
      } else {
        const tabItems = combinedInventory.filter(i => (i.Type||'').toString().trim().toLowerCase() === currentTab.toLowerCase());
        uploadItems = tabItems.map(i => {
          const q = localStorage.getItem('draft_' + currentTab + '_' + i.Code);
          const qVal = parseFloat(q)||0;
          return {
            Code: i.Code,
            'Item Name': i['Item Name'],
            'WH Unit': i['WH Unit'] || '',
            Refranc: i.Refranc || i.ref || '',
            Type: i.Type || '',
            Cost: parseFloat(i.Cost)||0,
            QTY: qVal
          };
        }).filter(i => i.QTY !== 0);
        
        // Extract OOS items
        const rawOos = getAllOOSProducts().filter(i => i._sourceTab === currentTab);
        oosItems = rawOos.map(i => ({
            Code: i.Code,
            'Item Name': i['Item Name'],
            'WH Unit': i['WH Unit'] || '',
            Refranc: i.Refranc || i.ref || '',
            Type: i.Type || '',
            Cost: parseFloat(i.Cost)||0,
            QTY: 0,
            isOOS: true
        }));
      }
      
      if(!uploadItems.length && !oosItems.length) return showAlert('No data to upload.','warning','No Data');
      
      const combinedPayload = uploadItems.concat(oosItems);

      document.getElementById('loader-message').innerText = 'Uploading Data';
      document.getElementById('loader-overlay').style.display = 'flex';
      fetch(SCRIPT_URL, {method:'POST',body:JSON.stringify({
        action:"upload",
        sheetName:currentTab,
        userName:currentUser,
        items:combinedPayload,
        oosItems: oosItems
      })
      }).then(async r => { if(!r.ok) throw new Error('Server '+r.status); return r.json(); }).then(async res => {
        document.getElementById('loader-overlay').style.display='none';
        if(res.status==='success') {
          await showAlert(res.msg,'success');

          if(isMaster) combinedInventory.forEach(item => ['q1','q2','q3'].forEach(s => localStorage.removeItem('draft_Master_' + item.Code + '_' + s)));
          else combinedInventory.filter(i => (i.Type||'').toString().trim().toLowerCase() === currentTab.toLowerCase()).forEach(item => localStorage.removeItem('draft_' + currentTab + '_' + item.Code));
          
          if(oosItems.length > 0) { oosItems.forEach(i => setOOS(currentTab, i.Code, false)); }
          
          renderTable();
        } else showAlert(res.msg,'error');
      }).catch(err => { document.getElementById('loader-overlay').style.display='none'; console.error(err); showAlert('Network error.','error'); });
    }
\n`;
html = html.replace(upOld, upNew);


// Fix 6: QTY CSS Input
const qtyOld = /\.qty-input \{\s*width: 100%; padding: 8px 0;\s*border: 2px solid transparent; background: rgba\(241, 245, 249, 0\.8\);\s*border-radius: 10px; text-align: center; font-size: 14px; font-weight: 800;\s*color: var\(--text-dark\); transition: var\(--transition-fast\);\s*\}/;
const qtyNew = `.qty-input {
  width: 100%; padding: 8px 0;
  border: 2px solid rgba(99, 102, 241, 0.25);
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(129, 140, 248, 0.05));
  border-radius: 10px; text-align: center; font-size: 14px; font-weight: 800;
  color: var(--primary-dark); transition: var(--transition-fast);
}`;
html = html.replace(qtyOld, qtyNew);

// Fix 7: OOS CSS (inserting before .oos-toggle)
if (!html.includes('th.oos-col')) {
  const oosToggleMatch = '.oos-toggle {';
  const oosCSSPrefix = '/* OOS First Column */\nth.oos-col {\n  background: rgba(245, 158, 11, 0.08) !important;\n  color: var(--warning) !important;\n  width: 44px;\n  font-size: 10px;\n  letter-spacing: 0;\n}\ntd.oos-cell {\n  background: rgba(245, 158, 11, 0.04);\n  width: 44px;\n  text-align: center;\n  border-right: 1px dashed rgba(245, 158, 11, 0.2);\n}\n\n';
  html = html.replace(oosToggleMatch, oosCSSPrefix + oosToggleMatch);
}

fs.writeFileSync('index.new.html', html);
console.log('Successfully generated clean index.new.html!');
