import { Repository } from './structure.js';
import sqlite3 from 'sqlite3'
// const sqlite3 = require('sqlite3').verbose();

// 包装数据库查询为返回 Promise 的函数  
function query(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

async function tableExists(db, tableName = "") {
    try {
        const rows = await query(db, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [tableName]);
        return rows.length > 0;
    } catch (err) {
        console.error('Error checking if table exists:', err.message);
        return false;
    }
}

// 创建表的函数（如果需要）  
async function createTableIfNotExists(db, tableName = "", createSql = "") {
    const exists = await tableExists(db, tableName);
    if (!exists) {
        try {
            await query(db, createSql);
            console.log(`Table ${tableName} created successfully.`);
        } catch (err) {
            console.error('Error creating table:', err.message);
        }
    } else {
        console.log(`Table ${tableName} already exists.`);
    }
}

// 异步函数来处理数据库操作  
async function initializeDatabase(pathToDB = "", tables = [['my_table','id INTEGER PRIMARY KEY, name TEXT']]) {
    let db = new sqlite3.Database(pathToDB, (err) => {
        if (err) {
            console.error(err.message);
            return;
        }
        console.log('Connected to the SQLite database >>=', pathToDB);
    });

    // 执行初始化操作
    for(var table of tables) {
        try {
            await createTableIfNotExists(db, table[0], `CREATE TABLE ${table[0]} (${table[1]})`);
        } catch (err) {
            console.error('Error during database initialization:', err.message);
        }
    }

    return db;
}

export async function openRepositoryMinerDB(path = "") {
    var db = await initializeDatabase(path, [
        ['Repo', 'fullname TEXT PRIMARY KEY, homeurl TEXT, baseuml TEXT, commitsurl TEXT, stars INTEGER'],
        ['File', 'contentsurl TEXT PRIMARY KEY, filename TEXT, bloburl TEXT, patch TEXT, status TEXT, curcommit TEXT, prevcommit TEXT']
    ]);

    return db
}

export async function saveRepository(db, repo = new Repository()) {
    const stmt = db.prepare("INSERT INTO Repo VALUES (?, ?, ?, ?, ?)");  
    await new Promise((resolve, reject) => {
        stmt.run(repo.fullname, repo.homeUrl, repo.baseUrl, repo.commitsUrl, repo.stars, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
    stmt.finalize();
}

export async function saveRepositoryList(db, repoList = []) {
    const stmt = db.prepare("INSERT INTO Repo VALUES (?, ?, ?, ?, ?)");  
    await new Promise((resolve, reject) => {
        for(var repo of repoList) {
            stmt.run(repo.fullname, repo.homeUrl, repo.baseUrl, repo.commitsUrl, repo.stars, (err) => {  
              if (err) reject(err);  
              else resolve();  
            });  
        }
    });
    stmt.finalize();
}

export async function saveFileList(db, fileList = []) {
    const stmt = db.prepare("INSERT INTO File VALUES (?, ?, ?, ?, ?, ?, ?)");  
    await new Promise((resolve, reject) => {
        for(var file of fileList) {
            stmt.run(file.contentsUrl, file.filename, file.blobUrl, file.patch, file.status, file.curCommit, file.prevCommit, (err) => {  
              if (err) reject(err);  
              else resolve();  
            });  
        }
    });
    stmt.finalize();
}

export async function repositoryExist(db, repo = new Repository()) {
    try {
        const row = await new Promise((resolve, reject) => {
            db.get("SELECT commitsurl FROM Repo WHERE fullname = ?", repo.fullname, (err, row) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(row);
                }
            });
        });
        return row != undefined;
    } catch(err) {
        return false;
    }

}
