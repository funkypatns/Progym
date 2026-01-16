const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');

async function check() {
    try {
        const SQL = await initSqlJs();
        const dbPath = path.join(__dirname, 'data/licenses.db');

        if (!fs.existsSync(dbPath)) {
            console.log("Database file not found at", dbPath);
            return;
        }

        const data = fs.readFileSync(dbPath);
        const db = new SQL.Database(data);

        // select license_key, type, status from licenses
        const res = db.exec("SELECT license_key, type, status, expires_at FROM licenses ORDER BY id DESC LIMIT 5");

        if (res.length > 0) {
            console.log("Found Licenses:");
            res[0].values.forEach(row => {
                console.log(`- Key: ${row[0]} | Type: ${row[1]} | Status: ${row[2]} | Expires: ${row[3]}`);
            });
        } else {
            console.log("No licenses found.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
}
check();
