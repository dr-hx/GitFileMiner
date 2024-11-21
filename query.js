import {RepositorySet, Repository, Commit, File} from "./structure.js"

export const CODE = "code";
export const REPOSITORIES = "repositories";

export async function query(octokit, target = "", queryTerm = "", consumingFunction, stoppingFunction = ()=>true) {
    let url = `/search/${target}?q=${queryTerm}`
    await _query(octokit, url, consumingFunction, stoppingFunction)
}

export async function queryRepositories(octokit, queryTerm = "", limits=0, per_page = 50) {
  let url = `/search/${REPOSITORIES}?q=${queryTerm}`
  var set = new RepositorySet();
  await _query(octokit, url, (item)=>collectRepository(set, item), ()=>{
    if(limits==0) return false;
    else return set.length() >= limits;
  }, per_page)
  return set;
}

function collectRepository(set=new RepositorySet(), item) {
  var r = new Repository();
  r.fullname = item.full_name;
  r.baseUrl = item.url;
  r.commitsUrl = item.commits_url;
  r.homeUrl = item.html_url;
  r.stars = item.stargazers_count;
  set.addRepository(r);
}

function toString(arr) {
  if(arr == undefined) ""
  else arr.join(',')
}

export async function queryCommits(octokit, r = new Repository()) {
  await iterateCommits(octokit, r.commitsUrl, (c)=>{
    var commit = new Commit();
    commit.message = c.commit.message;
    commit.url = c.url;
    commit.parents = c.parents == undefined ? [] : c.parents.map(e=>e.url)
    commit.prevCommit = c.parents
    r.commits.push(commit);
  })
  return r.commits;
}

export async function queryChangedFiles(octokit, c = new Commit()) {
  const response = await octokit.request(`GET ${c.url}`, {
    headers: {
      "X-GitHub-Api-Version":"2022-11-28",
    }
  })

  if(response.status == 200) {
    for(var f of response.data.files) {
      var file = new File();
      file.filename = f.filename;
      file.blobUrl = f.blob_url;
      file.contentsUrl = f.contents_url;
      file.patch = f.patch;
      file.status = f.status;
      file.curCommit = c.url;
      file.prevCommit = c.parents.toString();
      c.files.push(file);
    }
  } else {
    console.log('error =>', response);
  }

  return c.files;
}

export async function iterateCommits(octokit, commitsUrl = "", consumingFunction, stoppingFunction = ()=>false) {
  var url = commitsUrl.endsWith("{/sha}") ? commitsUrl.substring(0, commitsUrl.length - 6) : commitsUrl
  await _query(octokit, url, consumingFunction, stoppingFunction, 500)
}

async function _query(octokit, initialQuery = "", consumingFunction, stoppingFunction = ()=>true, per_page = 50) {
  const nextPattern = /(?<=<)([\S]*)(?=>; rel="next")/i;
  let pagesRemaining = true;
  let url = initialQuery
  var count = 0;
  var response = null
  while (pagesRemaining) {
      response = await octokit.request(`GET ${url}`, {
        per_page: per_page,
        headers: {
          "X-GitHub-Api-Version":"2022-11-28",
        }
      });

      if(response.status == 200) {
        var items = wrapData(response.data);
        for(var i of items) {
            consumingFunction(i)
        }
        const linkHeader = response.headers.link;
        pagesRemaining = linkHeader && linkHeader.includes(`rel=\"next\"`) && stoppingFunction()==false;
        
        if (pagesRemaining) {
          url = linkHeader.match(nextPattern)[0];
          await new Promise(resolve => {
              setTimeout(() => {
                process.stdout.write(`\rchecked pages ${++count}`);
                resolve();
              }, 2000);
          })
        }
      } else {
        pagesRemaining = false;
      }
  }

  process.stdout.clearLine();
  process.stdout.cursorTo(0);
  
  if(response.status != 200) {
    console.error(response);
  }
}

function wrapData(data) {
    if (Array.isArray(data)) {
        return data;
    }
    if (!data) {
      return []
    }
    return data.items;
}

export async function searchFiles(octokit, repoList = [], isCandidate = (file = new File()) => true, actionPerRepo = async (fileList = []) => {}) {
  var focusedFiles = [];
  for(var repo of repoList) {
    var filesInRepo = []
    console.log('search files in repo :>> ', repo.fullname);
    await searchFilesFromRepository(octokit, repo, filesInRepo, isCandidate);
    await actionPerRepo(filesInRepo)
    focusedFiles.concat(filesInRepo);
  }
  return focusedFiles;
}

export async function searchFilesFromRepository(octokit, repo = new Repository(), focusedFiles = [], isCandidate = (file = new File()) => true) {
  var commits = await queryCommits(octokit, repo)
  repo.commits = null
  const totalCommits = commits.length;

  while(commits.length != 0) {
    process.stdout.write(`unexplored commits ${Math.round(commits.length * 100.0 / totalCommits)}%`);
    var commit = commits.pop();
    var files = await queryChangedFiles(octokit, commit);
    commit.files = null;
    while(files.length != 0) {
      var file = files.pop();
      if(isCandidate(file)) {
        focusedFiles.push(file);
      }
    }
    process.stdout.clearLine()
    process.stdout.cursorTo(0);
  }
}