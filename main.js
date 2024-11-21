import {Octokit} from "octokit";
import {authKey} from "./auth.js";
import { queryRepositories, searchFiles} from "./query.js";
import fs from "fs";
import { openRepositoryMinerDB, repositoryExist, saveRepositoryList, saveFileList } from "./database.js";

const octokit = new Octokit({
    auth: authKey
  })

var db = await openRepositoryMinerDB('./out/jinja.db')

var repoSet = await queryRepositories(octokit, encodeURIComponent('language:JinJa'), 1, 1);

var toExplore = []

for(var r of repoSet.getRepositories()) {
  if(!(await repositoryExist(db, r))) {
    toExplore.push(r)
  }
}

await saveRepositoryList(db, toExplore)

console.log('%d new repositories will be explored', toExplore.length);

var candidates = await searchFiles(octokit, toExplore, 
  (file) => {
    var patch = file.patch == undefined ? "" : file.patch;
    return file.status === "modified" && file.filename.endsWith('.j2') && patch.search(/{%\s*if|for|elif|else|macro|call\s+/) >= 0;
  },
  async (fileList) => {
    await saveFileList(db, fileList)
  }
)

db.close();

// dump candidates
var file = fs.openSync('./out/jinja.txt', 'w');

for(var f of candidates) {
  fs.appendFileSync(file, JSON.stringify(f, null, 2))
  fs.appendFileSync(file, '\n\n')
}
fs.closeSync(file)