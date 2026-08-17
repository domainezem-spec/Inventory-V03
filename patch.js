const fs = require('fs');
let html = fs.readFileSync('F:/Branchs\'/The Drive 2/project-EZEM/sys inv/assets/TheDrive2-Inventory-V.4.html', 'utf8');

// Fix 1: Login
const loginOld = /function attemptLogin\(\) \{[\s\S]*?document\.getElementById\('err-msg'\)\.style\.display = 'block';\s+\}\s+\}/;
const loginNew = `async function attemptLogin() {
      const n = document.getElementById('user-select').value;
      const p = document.getElementById('user-pass').value;

      if(!n || !p) {
        document.getElementById('err-msg').innerText = 'Please select user and enter password.';
        document.getElementById('err-msg').style.display = 'block';
        return;
      }

      document.getElementById('err-msg').style.display = 'none';
      const btn = document.querySelector('.btn-login');
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';

      try {
        const hasPasswords = masterData.users.length > 0 && 
          (masterData.users[0].pass !== undefined || masterData.users[0].Password !== undefined);

        if(hasPasswords) {
          const u = masterData.users.find(x => {
            const xName = x.name || x.Name || '';
            const xPass = x.pass || x.Password || x.password || '';
            return xName === n && String(xPass) === String(p);
          });
          if(u) {
            const normalizedUser = {
              name: u.name || u.Name,
              pass: u.pass || u.Password,
              role: u.role || u.Role || 'User',
              dept: u.dept || u.Department || 'All'
            };
            localStorage.setItem('ezem_session_name', normalizedUser.name);
            localStorage.setItem('ezem_session_obj', JSON.stringify(normalizedUser));
            loginUser(normalizedUser, true);
          } else {
            document.getElementById('err-msg').innerText = 'Authentication Failed. Check your password.';
            document.getElementById('err-msg').style.display = 'block';
          }
        } else {
          const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', name: n, pass: p })
          });
          const result = await res.json();
          if(result.status === 'success') {
            const u = result.user;
            localStorage.setItem('ezem_session_name', u.name);
            localStorage.setItem('ezem_session_obj', JSON.stringify(u));
            loginUser(u, true);
          } else {
            document.getElementById('err-msg').innerText = 'Authentication Failed. Check your password.';
            document.getElementById('err-msg').style.display = 'block';
          }
        }
      } catch(err) {
        console.error(err);
        document.getElementById('err-msg').innerText = 'Connection error. Try again.';
        document.getElementById('err-msg').style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'ACCESS DASHBOARD';
      }
    }`;
html = html.replace(loginOld, loginNew);

// Fix 2: populateLogin
const popLoginOld = /function populateLogin\(users\) \{[\s\S]*?\}\s+\}/;
const popLoginNew = `function populateLogin(users) {
      const s = document.getElementById('user-select');
      users.forEach(u => {
        const userName = u.name || u.Name || '';
        if(!userName) return;
        let o = document.createElement('option');
        o.value = userName;
        o.text  = userName;
        s.appendChild(o);
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
const upOld = /async function confirmUpload\(\) \{[\s\S]*?function clearAllInputs\(\)/;
const upNew = `async function confirmUpload() {
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
      
      // Combine for single telegram report
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
          
          // Clear OOS for this tab
          if(oosItems.length > 0) {
            oosItems.forEach(i => setOOS(currentTab, i.Code, false));
          }
          
          renderTable();
        } else showAlert(res.msg,'error');
      }).catch(err => { document.getElementById('loader-overlay').style.display='none'; console.error(err); showAlert('Network error.','error'); });
    }

    async function clearAllInputs()`;
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
  html = html.replace(/\.oos-toggle \{/, 
`/* OOS First Column */
th.oos-col {
  background: rgba(245, 158, 11, 0.08) !important;
  color: var(--warning) !important;
  width: 44px;
  font-size: 10px;
  letter-spacing: 0;
}
td.oos-cell {
  background: rgba(245, 158, 11, 0.04);
  width: 44px;
  text-align: center;
  border-right: 1px dashed rgba(245, 158, 11, 0.2);
}

.oos-toggle {`);
}

fs.writeFileSync('index.new.html', html);
console.log('Successfully generated single-file index.new.html with all fixes!');
