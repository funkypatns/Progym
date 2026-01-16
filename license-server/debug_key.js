const fs = require('fs');
const initSqlJs = require('sql.js');
const path = require('path');

async function checkKey(keyToCheck) {
    try {
        const SQL = await initSqlJs();
        const dbPath = path.join(__dirname, 'data/licenses.db');

        if (!fs.existsSync(dbPath)) {
            console.log("Database file not found at", dbPath);
            return;
        }

        const data = fs.readFileSync(dbPath);
        const db = new SQL.Database(data);

        console.log(`Checking key: ${keyToCheck}`);

        // Check exact key
        const stmt = db.prepare("SELECT * FROM licenses WHERE license_key = ?");
        stmt.bind([keyToCheck]);

        if (stmt.step()) {
            const row = stmt.getAsObject();
            console.log("✅ Key FOUND in database:");
            console.log(JSON.stringify(row, null, 2));
        } else {
            console.log("❌ Key NOT FOUND in database.");

            // List all keys just in case
            console.log("\nListing active keys in DB:");
            const res = db.exec("SELECT license_key, status FROM licenses");
            if (res.length > 0) {
                res[0].values.forEach(v => console.log(`- ${v[0]} (${v[1]})`));
            }
        }
        stmt.free();

    } catch (e) {
        console.error("Error:", e);
    }
}

checkKey('GYM-YEAR-228R-BSS8');
