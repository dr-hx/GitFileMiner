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

var candidates = await searchFiles(octokit, toExplore, (file) => {
  return file.status === "modified" && file.filename.endsWith('.j2');
})

await saveRepositoryList(db, toExplore)
await saveFileList(db, candidates)

db.close();

// dump candidates
var file = fs.openSync('./out/jinja.txt', 'w');

for(var f of candidates) {
  fs.appendFileSync(file, JSON.stringify(f, null, 2))
  fs.appendFileSync(file, '\n\n')
}
fs.closeSync(file)